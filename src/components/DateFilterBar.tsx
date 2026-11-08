import React from 'react';
import { Calendar, Filter } from 'lucide-react';
import type { DateFilterType, DateRange } from '../types';

interface DateFilterBarProps {
  dateFilter: DateFilterType;
  setDateFilter: (filter: DateFilterType) => void;
  dateRange: DateRange;
  setDateRange: React.Dispatch<React.SetStateAction<DateRange>>;
  periodLabel: string;
  labelPrefix?: string;
  style?: React.CSSProperties;
}

export const DateFilterBar: React.FC<DateFilterBarProps> = ({
  dateFilter,
  setDateFilter,
  dateRange,
  setDateRange,
  periodLabel,
  labelPrefix = 'Rentang Waktu',
  style,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        padding: '10px 16px',
        backgroundColor: '#ffffff',
        border: '1px solid var(--border-medium)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-xs)',
        ...style,
      }}
    >
      {/* Active Period Label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '200px' }}>
        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--bg-subtle)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-main)',
            flexShrink: 0,
          }}
        >
          <Calendar size={15} />
        </div>
        <div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: '500' }}>
            {labelPrefix}
          </div>
          <div style={{ fontSize: '0.8125rem', fontWeight: '600', color: 'var(--text-main)' }}>
            {periodLabel}
          </div>
        </div>
      </div>

      {/* Quick Filter Buttons & Inputs */}
      <div className="date-filter-bar__buttons" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setDateFilter('today')}
          className={`btn btn-sm ${dateFilter === 'today' ? 'btn-primary' : 'btn-outline'}`}
          style={{ fontSize: '0.75rem', padding: '4px 10px', height: '28px' }}
        >
          Hari Ini
        </button>

        <button
          type="button"
          onClick={() => setDateFilter('week')}
          className={`btn btn-sm ${dateFilter === 'week' ? 'btn-primary' : 'btn-outline'}`}
          style={{ fontSize: '0.75rem', padding: '4px 10px', height: '28px' }}
        >
          Minggu Ini
        </button>

        <button
          type="button"
          onClick={() => setDateFilter('month')}
          className={`btn btn-sm ${dateFilter === 'month' ? 'btn-primary' : 'btn-outline'}`}
          style={{ fontSize: '0.75rem', padding: '4px 10px', height: '28px' }}
        >
          Bulan Ini
        </button>

        <button
          type="button"
          onClick={() => setDateFilter('year')}
          className={`btn btn-sm ${dateFilter === 'year' ? 'btn-primary' : 'btn-outline'}`}
          style={{ fontSize: '0.75rem', padding: '4px 10px', height: '28px' }}
        >
          Tahun Ini
        </button>

        <button
          type="button"
          onClick={() => setDateFilter('all')}
          className={`btn btn-sm ${dateFilter === 'all' ? 'btn-primary' : 'btn-outline'}`}
          style={{ fontSize: '0.75rem', padding: '4px 10px', height: '28px' }}
        >
          Semua
        </button>

        <button
          type="button"
          onClick={() => setDateFilter('custom')}
          className={`btn btn-sm ${dateFilter === 'custom' ? 'btn-primary' : 'btn-outline'}`}
          style={{ fontSize: '0.75rem', padding: '4px 10px', height: '28px', display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          <Filter size={12} />
          <span>Rentang Khusus</span>
        </button>

        {/* Custom Start & End Date Inputs */}
        {dateFilter === 'custom' && (
          <div
            className="date-filter-bar__custom-inputs"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--bg-subtle)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-sm)',
              padding: '2px 8px',
            }}
          >
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange((prev) => ({ ...prev, startDate: e.target.value }))}
              style={{
                fontSize: '0.75rem',
                padding: '2px 4px',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                background: '#ffffff',
                color: 'var(--text-main)',
                outline: 'none',
                fontFamily: 'inherit',
              }}
              title="Tanggal Mulai"
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>s/d</span>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange((prev) => ({ ...prev, endDate: e.target.value }))}
              style={{
                fontSize: '0.75rem',
                padding: '2px 4px',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                background: '#ffffff',
                color: 'var(--text-main)',
                outline: 'none',
                fontFamily: 'inherit',
              }}
              title="Tanggal Selesai"
            />
          </div>
        )}
      </div>
    </div>
  );
};
