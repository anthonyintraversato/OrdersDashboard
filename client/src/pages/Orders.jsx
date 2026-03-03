import { useState, useEffect, useCallback, useRef } from 'react';
import { getUnfulfilledOrders, getOrdersSummary, triggerSync } from '../lib/api';

const CHANNEL_COLORS = {
  StockX: 'bg-green-800/20 text-green-300 border-green-700/40',
  GOAT: 'bg-purple-800/20 text-purple-300 border-purple-700/40',
  SHEIN: 'bg-blue-800/20 text-blue-300 border-blue-700/40',
  eBay: 'bg-yellow-800/20 text-yellow-300 border-yellow-700/40',
  TikTok: 'bg-teal-800/20 text-teal-300 border-teal-700/40',
  KicksCrew: 'bg-orange-800/20 text-orange-300 border-orange-700/40',
  Amazon: 'bg-amber-800/20 text-amber-300 border-amber-700/40',
  Shopify: 'bg-stone-700/20 text-stone-400 border-stone-600/40',
  Whatnot: 'bg-pink-800/20 text-pink-300 border-pink-700/40',
};

const SLA_COLORS = {
  green: 'text-emerald-700',
  yellow: 'text-amber-600',
  red: 'text-red-700 font-semibold',
};

const AGE_FILTERS = [
  { value: '', label: 'All' },
  { value: 'today', label: 'Today' },
  { value: '24h', label: '24h+' },
  { value: '48h', label: '48h+' },
  { value: 'overdue', label: 'Overdue' },
];

const ALL_CHANNELS = ['StockX', 'GOAT', 'SHEIN', 'eBay', 'TikTok', 'KicksCrew', 'Amazon', 'Shopify', 'Whatnot'];

const ADMIN_DOMAIN = 'nzw1ru-un.myshopify.com';

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [error, setError] = useState(null);

  // Filters
  const [selectedChannels, setSelectedChannels] = useState([]);
  const [locationFilter, setLocationFilter] = useState('');
  const [ageFilter, setAgeFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, 400);
  const [sortCol, setSortCol] = useState('age');
  const [sortDir, setSortDir] = useState('asc');
  const [channelDropdownOpen, setChannelDropdownOpen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      setFetching(true);
      const params = {};
      if (selectedChannels.length > 0) params.channel = selectedChannels.join(',');
      if (locationFilter) params.location = locationFilter;
      if (ageFilter) params.age = ageFilter;
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      params.sort = sortCol;
      params.direction = sortDir;

      const [ordersData, summaryData] = await Promise.all([
        getUnfulfilledOrders(params),
        getOrdersSummary(),
      ]);
      setOrders(ordersData);
      setSummary(summaryData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setFetching(false);
    }
  }, [selectedChannels, locationFilter, ageFilter, debouncedSearch, sortCol, sortDir]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    setError(null);
    try {
      const result = await triggerSync();
      setSyncResult(result);
      await fetchData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const toggleChannel = (ch) => {
    setSelectedChannels(prev =>
      prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]
    );
  };

  const sortIndicator = (col) => {
    if (sortCol !== col) return '';
    return sortDir === 'asc' ? ' \u2191' : ' \u2193';
  };

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-earth-950">Unfulfilled Orders</h1>
          {fetching && !loading && (
            <span className="text-xs text-earth-400 animate-pulse">Updating...</span>
          )}
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="px-4 py-2 bg-earth-950 text-earth-100 rounded text-sm font-medium
                     hover:bg-earth-800 disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors"
        >
          {syncing ? 'Syncing...' : 'Sync Now'}
        </button>
      </div>

      {/* Sync result banner */}
      {syncResult && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded text-sm">
          Synced {syncResult.processed} orders ({syncResult.unfulfilled} unfulfilled, {syncResult.partial} partial, {syncResult.cancelled} cancelled)
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded text-sm">
          {error}
        </div>
      )}

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard
            label="Total Unfulfilled"
            value={summary.total_unfulfilled}
          />
          <SummaryCard
            label="Overdue"
            value={summary.overdue_count}
            alert={summary.overdue_count > 0}
          />
          <SummaryCard
            label="Avg Age"
            value={summary.avg_age_display}
          />
          <div className="bg-white rounded-lg border border-earth-200 p-4">
            <p className="text-xs text-earth-500 uppercase tracking-wider mb-2">By Channel</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(summary.by_channel).map(([ch, count]) => (
                <span
                  key={ch}
                  className={`text-xs px-2 py-0.5 rounded border ${CHANNEL_COLORS[ch] || 'bg-stone-100 text-stone-600 border-stone-300'}`}
                >
                  {ch} {count}
                </span>
              ))}
              {Object.keys(summary.by_channel).length === 0 && (
                <span className="text-xs text-earth-500">No orders</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Age filter */}
        <div className="flex rounded-lg border border-earth-200 overflow-hidden">
          {AGE_FILTERS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setAgeFilter(value)}
              className={`px-3 py-1.5 text-sm transition-colors ${
                ageFilter === value
                  ? 'bg-earth-950 text-earth-100'
                  : 'bg-white text-earth-600 hover:bg-earth-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Channel filter dropdown */}
        <div className="relative">
          <button
            onClick={() => setChannelDropdownOpen(!channelDropdownOpen)}
            className="px-3 py-1.5 text-sm bg-white border border-earth-200 rounded-lg
                       text-earth-600 hover:bg-earth-50 transition-colors"
          >
            Channels {selectedChannels.length > 0 ? `(${selectedChannels.length})` : ''}
          </button>
          {channelDropdownOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setChannelDropdownOpen(false)} />
              <div className="absolute top-full mt-1 left-0 bg-white border border-earth-200
                              rounded-lg shadow-lg z-20 py-1 w-44">
                {ALL_CHANNELS.map(ch => (
                  <label
                    key={ch}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-earth-700
                               hover:bg-earth-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedChannels.includes(ch)}
                      onChange={() => toggleChannel(ch)}
                      className="accent-earth-950"
                    />
                    <span className={`text-xs px-1.5 py-0.5 rounded border ${CHANNEL_COLORS[ch]}`}>
                      {ch}
                    </span>
                  </label>
                ))}
                {selectedChannels.length > 0 && (
                  <button
                    onClick={() => setSelectedChannels([])}
                    className="w-full text-left px-3 py-1.5 text-xs text-earth-500
                               hover:bg-earth-50 border-t border-earth-100 mt-1"
                  >
                    Clear all
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Location filter */}
        <div className="flex rounded-lg border border-earth-200 overflow-hidden">
          {[{ value: '', label: 'All' }, { value: 'PDX', label: 'PDX' }, { value: 'LA', label: 'LA' }].map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setLocationFilter(value)}
              className={`px-3 py-1.5 text-sm transition-colors ${
                locationFilter === value
                  ? 'bg-earth-950 text-earth-100'
                  : 'bg-white text-earth-600 hover:bg-earth-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search order #, SKU, customer..."
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          className="px-3 py-1.5 text-sm bg-white border border-earth-200 rounded-lg
                     text-earth-700 placeholder-earth-400 w-64 focus:outline-none
                     focus:border-earth-400 transition-colors"
        />
      </div>

      {/* Orders table */}
      {loading ? (
        <div className="text-center py-16 text-earth-500">Loading orders...</div>
      ) : (
        <div className="bg-white rounded-lg border border-earth-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-earth-50 border-b border-earth-200">
                  <Th onClick={() => handleSort('order')} label={`Order #${sortIndicator('order')}`} />
                  <Th onClick={() => handleSort('channel')} label={`Channel${sortIndicator('channel')}`} />
                  <Th onClick={() => handleSort('age')} label={`Age${sortIndicator('age')}`} />
                  <th className="px-4 py-3 text-left text-xs font-medium text-earth-500 uppercase tracking-wider">Items</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-earth-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-earth-500 uppercase tracking-wider">Location</th>
                  <Th onClick={() => handleSort('customer')} label={`Customer${sortIndicator('customer')}`} />
                  <Th onClick={() => handleSort('total')} label={`Total${sortIndicator('total')}`} />
                </tr>
              </thead>
              <tbody className="divide-y divide-earth-100">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center text-earth-500">
                      No unfulfilled orders found. Hit "Sync Now" to pull from Shopify.
                    </td>
                  </tr>
                ) : (
                  orders.map(order => (
                    <OrderRow key={order.id} order={order} />
                  ))
                )}
              </tbody>
            </table>
          </div>
          {orders.length > 0 && (
            <div className="px-4 py-3 bg-earth-50 border-t border-earth-200 text-xs text-earth-500">
              {orders.length} order{orders.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, alert }) {
  return (
    <div className={`bg-white rounded-lg border p-4 ${alert ? 'border-red-300' : 'border-earth-200'}`}>
      <p className="text-xs text-earth-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${alert ? 'text-red-700' : 'text-earth-950'}`}>
        {value}
      </p>
    </div>
  );
}

function Th({ onClick, label }) {
  return (
    <th
      onClick={onClick}
      className="px-4 py-3 text-left text-xs font-medium text-earth-500 uppercase tracking-wider
                 cursor-pointer hover:text-earth-700 select-none"
    >
      {label}
    </th>
  );
}

function OrderRow({ order }) {
  const [expanded, setExpanded] = useState(false);
  const channelColor = CHANNEL_COLORS[order.channel] || 'bg-stone-100 text-stone-600 border-stone-300';
  const slaColor = SLA_COLORS[order.sla_status] || '';

  let lineItems = [];
  try {
    lineItems = typeof order.line_items === 'string' ? JSON.parse(order.line_items) : (order.line_items || []);
  } catch {
    lineItems = [];
  }

  const firstItem = lineItems[0];
  const itemSummary = firstItem
    ? `${firstItem.sku || firstItem.title || 'Item'}`
    : '\u2014';

  return (
    <>
      <tr className="hover:bg-earth-50/50 transition-colors">
        <td className="px-4 py-3 font-mono text-xs">
          <a
            href={`https://${ADMIN_DOMAIN}/admin/orders/${order.shopify_order_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-earth-400 hover:text-earth-950 underline decoration-earth-300"
          >
            {order.order_number}
          </a>
        </td>
        <td className="px-4 py-3">
          <span className={`text-xs px-2 py-0.5 rounded border ${channelColor}`}>
            {order.channel}
          </span>
        </td>
        <td className={`px-4 py-3 text-xs ${slaColor}`}>
          {order.age_display}
        </td>
        <td className="px-4 py-3 text-xs text-earth-600">
          <button
            onClick={() => lineItems.length > 1 && setExpanded(!expanded)}
            className={`text-left ${lineItems.length > 1 ? 'cursor-pointer hover:text-earth-950' : ''}`}
          >
            {itemSummary}
            {lineItems.length > 1 && (
              <span className="text-earth-400 ml-1">+{lineItems.length - 1}</span>
            )}
          </button>
        </td>
        <td className="px-4 py-3 text-xs text-earth-600 capitalize">
          {order.status.replace('_', ' ')}
        </td>
        <td className="px-4 py-3 text-xs text-earth-600">
          {order.location}
        </td>
        <td className="px-4 py-3 text-xs text-earth-600">
          {order.customer_name}
        </td>
        <td className="px-4 py-3 text-xs text-earth-600 font-mono">
          ${parseFloat(order.total_price).toFixed(2)}
        </td>
      </tr>
      {expanded && lineItems.length > 0 && (
        <tr className="bg-earth-50/30">
          <td colSpan={8} className="px-8 py-2">
            <div className="space-y-1">
              {lineItems.map((item, i) => (
                <div key={i} className="text-xs text-earth-600">
                  <span className="font-mono text-earth-400">{item.sku || '\u2014'}</span>
                  <span className="mx-2">\u00b7</span>
                  <span>{item.title}</span>
                  {item.variant_title && <span className="text-earth-400 ml-1">({item.variant_title})</span>}
                  <span className="text-earth-400 ml-2">x{item.quantity}</span>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
