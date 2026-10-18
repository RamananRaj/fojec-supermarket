// Sales figures for the admin Dashboard, straight from Square's orders, so
// till and website sales are counted together.
import { requireAdmin } from '../../../lib/server/requireAdmin';
import { getConnectionRow, getAccessToken, squareFetch } from '../../../lib/server/square';

const ONLINE_SOURCE = 'Fojec Website';

// Offset (minutes) of a time zone at a given instant, e.g. +660 for Melbourne in summer.
function tzOffset(date, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(date)
      .map((p) => [p.type, p.value])
  );
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return Math.round((asUtc - date.getTime()) / 60000);
}

function localParts(date, timeZone) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit' })
      .formatToParts(date)
      .map((x) => [x.type, x.value])
  );
  return { day: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
}

// Midnight at the start of `day` (YYYY-MM-DD) in the shop's time zone, as a Date.
function startOfLocalDay(day, timeZone) {
  const guess = new Date(`${day}T00:00:00Z`);
  const first = new Date(guess.getTime() - tzOffset(guess, timeZone) * 60000);
  // Re-check the offset at the result itself, so daylight-saving change days are right.
  return new Date(guess.getTime() - tzOffset(first, timeZone) * 60000);
}

function addDays(day, n) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function fetchOrders(token, locationId, startAt, endAt) {
  const orders = [];
  let cursor;
  do {
    const r = await squareFetch('/v2/orders/search', {
      token,
      method: 'POST',
      body: {
        location_ids: [locationId],
        limit: 500,
        ...(cursor ? { cursor } : {}),
        query: {
          filter: {
            state_filter: { states: ['COMPLETED'] },
            date_time_filter: { closed_at: { start_at: startAt, end_at: endAt } },
          },
          sort: { sort_field: 'CLOSED_AT', sort_order: 'DESC' },
        },
      },
    });
    orders.push(...(r.orders || []));
    cursor = r.cursor;
  } while (cursor && orders.length < 5000);
  return orders;
}

const cents = (m) => Number(m?.amount || 0);
const orderTotal = (o) => cents(o.net_amounts?.total_money ?? o.total_money);
const isOnline = (o) => o.source?.name === ONLINE_SOURCE;

function summarise(orders) {
  const s = { sales: 0, inStore: 0, online: 0, count: orders.length, onlineCount: 0 };
  for (const o of orders) {
    const t = orderTotal(o);
    s.sales += t;
    if (isOnline(o)) {
      s.online += t;
      s.onlineCount += 1;
    } else s.inStore += t;
  }
  s.average = s.count ? Math.round(s.sales / s.count) : 0;
  return s;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const user = await requireAdmin(req, res);
  if (!user) return;

  const period = ['today', '7d', '30d'].includes(req.query.period) ? req.query.period : 'today';
  const days = { today: 1, '7d': 7, '30d': 30 }[period];

  try {
    const conn = await getConnectionRow();
    if (!conn?.location_id) return res.json({ connected: false });
    const token = await getAccessToken(conn);
    const { location } = await squareFetch(`/v2/locations/${conn.location_id}`, { token });
    // Square test accounts often report UTC; Fojec trades on Melbourne time.
    const sqTz = location?.timezone;
    const timeZone = sqTz && !/^(Etc\/)?(UTC|GMT)$/i.test(sqTz) ? sqTz : 'Australia/Melbourne';

    const now = new Date();
    const today = localParts(now, timeZone).day;
    const firstDay = addDays(today, -(days - 1));
    const start = startOfLocalDay(firstDay, timeZone);
    const prevStart = startOfLocalDay(addDays(firstDay, -days), timeZone);
    // Compare like with like: the previous period up to the same point in time.
    const prevEnd = new Date(prevStart.getTime() + (now.getTime() - start.getTime()));

    const [orders, prevOrders] = await Promise.all([
      fetchOrders(token, conn.location_id, start.toISOString(), now.toISOString()),
      fetchOrders(token, conn.location_id, prevStart.toISOString(), prevEnd.toISOString()),
    ]);

    const current = summarise(orders);
    const previous = summarise(prevOrders);

    // Chart buckets: hours for today, days otherwise.
    let buckets;
    if (period === 'today') {
      const hours = orders.map((o) => localParts(new Date(o.closed_at), timeZone).hour);
      const lo = Math.min(8, ...hours);
      const hi = Math.max(21, ...hours);
      buckets = [];
      for (let h = lo; h <= hi; h += 1) {
        const label = h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`;
        buckets.push({ key: h, label, sales: 0, count: 0 });
      }
      for (const o of orders) {
        const b = buckets.find((x) => x.key === localParts(new Date(o.closed_at), timeZone).hour);
        if (b) {
          b.sales += orderTotal(o);
          b.count += 1;
        }
      }
    } else {
      buckets = Array.from({ length: days }, (_, i) => {
        const day = addDays(firstDay, i);
        const d = new Date(`${day}T12:00:00Z`);
        return {
          key: day,
          label: d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', timeZone: 'UTC' }),
          sales: 0,
          count: 0,
        };
      });
      for (const o of orders) {
        const b = buckets.find((x) => x.key === localParts(new Date(o.closed_at), timeZone).day);
        if (b) {
          b.sales += orderTotal(o);
          b.count += 1;
        }
      }
    }

    // Top sellers by quantity sold.
    const items = new Map();
    for (const o of orders) {
      for (const li of o.line_items || []) {
        const key = li.catalog_object_id || `name:${li.name}`;
        const cur = items.get(key) || { name: [li.name, li.variation_name && li.variation_name !== 'Regular' ? li.variation_name : null].filter(Boolean).join(' – ') || 'Custom amount', qty: 0, sales: 0 };
        cur.qty += Number(li.quantity || 0);
        cur.sales += cents(li.total_money);
        items.set(key, cur);
      }
    }
    const top = [...items.values()].sort((a, b) => b.qty - a.qty || b.sales - a.sales).slice(0, 5);

    return res.json({
      connected: true,
      period,
      timeZone,
      locationName: location?.name,
      from: start.toISOString(),
      current,
      previous,
      buckets,
      top,
      currency: location?.currency || 'AUD',
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
