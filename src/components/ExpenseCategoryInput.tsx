import { useState } from 'react';
import { Plus, Tag, Check, Trash2 } from 'lucide-react';
import type { ExpenseSector } from '../types';

interface ExpenseCategoryInputProps {
  sector: ExpenseSector;
  category: string;
  onCategoryChange: (newCategory: string) => void;
  description: string;
  onDescriptionChange: (newDescription: string) => void;
  isBbmCategory?: boolean;
  options?: string[];
  onAddOption?: (newOption: string) => void;
  onDeleteOption?: (option: string) => void;
}

export const ExpenseCategoryInput: React.FC<ExpenseCategoryInputProps> = ({
  category,
  onCategoryChange,
  description,
  onDescriptionChange,
  isBbmCategory = false,
  options,
  onAddOption,
  onDeleteOption,
}) => {
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [catError, setCatError] = useState('');

  // Use settings-driven options if provided, otherwise empty array
  const categories = options || [];

  const handleSaveCustomCategory = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setCatError('');

    const trimmed = newCategoryName.trim();
    if (!trimmed) {
      setCatError('Nama kategori wajib diisi');
      return;
    }

    if (categories.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      setCatError('Kategori dengan nama ini sudah ada');
      return;
    }

    if (onAddOption) {
      onAddOption(trimmed);
    }

    onCategoryChange(trimmed);
    setNewCategoryName('');
    setShowAddCategory(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* 1. Category Selection & Inline Quick Creator */}
      <div className="form-group" style={{ marginBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <label className="form-label" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Tag size={14} style={{ color: 'var(--primary-color)' }} />
            <span>Kategori Pengeluaran *</span>
          </label>

          {(onAddOption) && (
            <button
              type="button"
              onClick={() => {
                setShowAddCategory(!showAddCategory);
                setCatError('');
              }}
              className="btn btn-outline btn-sm"
              style={{
                padding: '2px 8px',
                fontSize: '0.75rem',
                color: showAddCategory ? 'var(--color-danger)' : 'var(--color-primary)',
                borderColor: showAddCategory ? 'var(--color-danger-border)' : 'var(--color-primary-border)',
              }}
            >
              {showAddCategory ? (
                'Batal'
              ) : (
                <>
                  <Plus size={12} />
                  <span>Kategori Baru</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Inline Quick Add Box */}
        {showAddCategory && (
          <div
            style={{
              padding: '12px 14px',
              backgroundColor: 'var(--color-primary-light)',
              border: '1px solid var(--color-primary-border)',
              borderRadius: 'var(--radius-md)',
              marginBottom: '10px',
            }}
          >
            <div style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--color-primary)', marginBottom: '6px' }}>
              + Tambah Kategori Baru:
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="Contoh: Service AC, Retribusi Limbah, Uang Lembur, dll"
                value={newCategoryName}
                onChange={(e) => {
                  setNewCategoryName(e.target.value);
                  if (catError) setCatError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSaveCustomCategory();
                  }
                }}
                className="form-input"
                style={{ fontSize: '0.85rem', flex: 1 }}
                autoFocus
              />
              <button
                type="button"
                onClick={() => handleSaveCustomCategory()}
                className="btn btn-primary btn-sm"
                style={{ whiteSpace: 'nowrap' }}
              >
                <Check size={14} />
                <span>Simpan & Pakai</span>
              </button>
            </div>
            {catError && (
              <div style={{ color: 'var(--color-danger)', fontSize: '0.75rem', marginTop: '4px' }}>{catError}</div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
          {categories.length === 0 && (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '8px 0' }}>
              Belum ada kategori pengeluaran. Tambahkan melalui tombol + Kategori Baru.
            </div>
          )}
          {categories.map((c, idx) => {
            const canDelete = options && onDeleteOption;
            
            return (
              <div
                key={idx}
                className="btn-group"
                style={{ display: 'inline-flex', borderRadius: '12px', overflow: 'hidden', border: `1px solid ${category === c ? 'var(--color-primary)' : 'var(--border-subtle)'}` }}
              >
                <button
                  type="button"
                  onClick={() => onCategoryChange(c)}
                  className={`btn btn-sm ${category === c ? 'btn-primary' : 'btn-outline'}`}
                  style={{ padding: '3px 8px', fontSize: '0.72rem', border: 'none', borderRadius: 0, backgroundColor: category === c ? 'var(--color-primary)' : 'transparent', color: category === c ? 'white' : 'var(--text-color)' }}
                >
                  {c}
                </button>
                {canDelete && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (options && onDeleteOption) {
                        onDeleteOption(c);
                      }
                    }}
                    className="btn btn-sm btn-outline"
                    style={{ padding: '3px 6px', fontSize: '0.72rem', border: 'none', borderLeft: '1px solid var(--border-subtle)', borderRadius: 0, color: 'var(--color-danger)' }}
                    title="Hapus opsi ini"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Description Input */ }
      {!isBbmCategory && (
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">
            Deskripsi Pengeluaran *
            <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: 'var(--text-dim)', marginLeft: '6px' }}>
              (Ketik bebas)
            </span>
          </label>
          <input
            type="text"
            placeholder="Contoh: Upah bongkar 560 tabung / Ganti oli mesin 15W-40"
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            className="form-input"
            required
          />
        </div>
      )}
    </div>
  );
};
