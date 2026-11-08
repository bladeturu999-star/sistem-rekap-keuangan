import React, { useState } from 'react';
import { Plus, Pencil, Trash2, X, Check, RefreshCw } from 'lucide-react';

interface OptionListManagerProps {
  title: string;
  icon?: React.ReactNode;
  description?: string;
  options: string[];
  onChange: (newOptions: string[]) => void;
  placeholder?: string;
}

export const OptionListManager: React.FC<OptionListManagerProps> = ({
  title,
  icon,
  description,
  options = [],
  onChange,
  placeholder = 'Ketik opsi baru...'
}) => {
  const [newItem, setNewItem] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [error, setError] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const val = newItem.trim();
    if (!val) {
      setError('Opsi tidak boleh kosong.');
      return;
    }
    if (options.some(opt => opt.toLowerCase() === val.toLowerCase())) {
      setError('Opsi ini sudah ada.');
      return;
    }
    onChange([...options, val]);
    setNewItem('');
  };

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    setEditValue(options[index]);
    setError('');
  };

  const saveEdit = (index: number) => {
    setError('');
    const val = editValue.trim();
    if (!val) {
      setError('Opsi tidak boleh kosong.');
      return;
    }
    if (options.some((opt, idx) => idx !== index && opt.toLowerCase() === val.toLowerCase())) {
      setError('Opsi dengan nama ini sudah ada.');
      return;
    }
    const newOptions = [...options];
    newOptions[index] = val;
    onChange(newOptions);
    setEditingIndex(null);
  };

  const handleDelete = (index: number) => {
    if (window.confirm(`Hapus opsi "${options[index]}"?`)) {
      const newOptions = [...options];
      newOptions.splice(index, 1);
      onChange(newOptions);
    }
  };

  const handleClearAll = () => {
    if (options.length === 0) return;
    if (window.confirm('PERINGATAN: Anda yakin ingin menghapus SEMUA daftar pilihan ini dari awal? Data transaksi lama tidak akan terhapus, tapi pilihan ini akan kosong.')) {
      onChange([]);
    }
  };

  return (
    <div className="card" style={{ marginBottom: '20px' }}>
      <div className="card-header" style={{ flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {icon}
            {title}
          </h3>
          {description && <p className="card-subtitle">{description}</p>}
        </div>
        <button
          onClick={handleClearAll}
          className="btn btn-outline btn-sm"
          style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger-border)', padding: '4px 8px' }}
          disabled={options.length === 0}
          title="Hapus Semua"
        >
          <RefreshCw size={14} />
          <span>Reset Semua</span>
        </button>
      </div>

      {error && (
        <div style={{ backgroundColor: 'var(--color-danger-light)', color: 'var(--color-danger-text)', padding: '8px 12px', borderRadius: '4px', fontSize: '0.85rem', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleAdd} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <input
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder={placeholder}
          className="form-input"
          style={{ flex: 1 }}
        />
        <button type="submit" className="btn btn-primary" style={{ padding: '8px 16px' }}>
          <Plus size={16} />
          <span>Tambah</span>
        </button>
      </form>

      {options.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)' }}>
          Belum ada data opsi yang ditambahkan.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {options.map((opt, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--bg-card)', padding: '8px 12px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
              {editingIndex === idx ? (
                <div style={{ display: 'flex', gap: '8px', flex: 1, marginRight: '12px' }}>
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="form-input"
                    style={{ flex: 1, padding: '4px 8px' }}
                    autoFocus
                  />
                  <button onClick={() => saveEdit(idx)} className="btn btn-success btn-sm" style={{ padding: '4px 8px' }}>
                    <Check size={14} />
                  </button>
                  <button onClick={() => setEditingIndex(null)} className="btn btn-secondary btn-sm" style={{ padding: '4px 8px' }}>
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <>
                  <span style={{ fontWeight: '500', fontSize: '0.9rem' }}>{opt}</span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => handleEdit(idx)} className="btn btn-outline btn-sm" style={{ padding: '4px' }}>
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => handleDelete(idx)} className="btn btn-outline btn-sm" style={{ padding: '4px', color: 'var(--color-danger)', borderColor: 'var(--color-danger-border)' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
