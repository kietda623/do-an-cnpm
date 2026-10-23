"use client";
import { useState, type FormEvent } from "react";
import { normalizeFormError } from "@marketplace/api-client";
export type CategoryRow = {
  id: string;
  parentId: string | null;
  name: string;
  visible: boolean;
  version: number;
  children?: CategoryRow[];
};
type CategoryInput = { name: string; parentId: string | null; visible: boolean };
const flatten = (items: CategoryRow[], depth = 0): Array<{ row: CategoryRow; depth: number }> =>
  items.flatMap((row) => [{ row, depth }, ...flatten(row.children ?? [], depth + 1)]);
export function CategoryEditor({
  rows,
  onSave,
}: {
  rows: CategoryRow[];
  onSave: (input: CategoryInput, row?: CategoryRow) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editParent, setEditParent] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const options = flatten(rows);
  const descendants = (row: CategoryRow): Set<string> =>
    new Set(flatten(row.children ?? []).map((item) => item.row.id));
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSave({ name: name.trim(), parentId: parentId || null, visible: true });
      setName("");
      setParentId("");
    } catch (cause) {
      setError(normalizeFormError(cause));
    } finally {
      setBusy(false);
    }
  }
  async function saveEdit(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setBusy(true);
    setError("");
    try {
      await onSave(
        { name: editName.trim(), parentId: editParent || null, visible: editing.visible },
        editing,
      );
      setEditing(null);
    } catch (cause) {
      setError(normalizeFormError(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="grid gap-4">
      <form className="grid gap-3 rounded border p-4" onSubmit={submit} aria-label="Tạo danh mục">
        <h2 className="font-semibold">Tạo danh mục</h2>
        <label>
          Tên danh mục
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={120}
          />
        </label>
        <label>
          Danh mục cha
          <select value={parentId} onChange={(event) => setParentId(event.target.value)}>
            <option value="">Không có</option>
            {options.map(({ row, depth }) => (
              <option key={row.id} value={row.id}>
                {"— ".repeat(depth)}
                {row.name}
              </option>
            ))}
          </select>
        </label>
        <button disabled={busy}>{busy ? "Đang lưu…" : "Tạo danh mục"}</button>
      </form>
      <ul aria-label="Cây danh mục" className="grid gap-2">
        {options.map(({ row, depth }) => (
          <li
            key={row.id}
            className="grid gap-2 rounded border p-3"
            style={{ marginLeft: depth * 20 }}
          >
            {editing?.id === row.id ? (
              <form className="grid gap-2" onSubmit={saveEdit}>
                <label>
                  Tên danh mục
                  <input
                    value={editName}
                    onChange={(event) => setEditName(event.target.value)}
                    required
                    maxLength={120}
                  />
                </label>
                <label>
                  Danh mục cha
                  <select
                    value={editParent}
                    onChange={(event) => setEditParent(event.target.value)}
                  >
                    <option value="">Không có</option>
                    {options
                      .filter(
                        ({ row: option }) =>
                          option.id !== row.id && !descendants(row).has(option.id),
                      )
                      .map(({ row: option, depth: optionDepth }) => (
                        <option key={option.id} value={option.id}>
                          {"— ".repeat(optionDepth)}
                          {option.name}
                        </option>
                      ))}
                  </select>
                </label>
                <div className="flex gap-2">
                  <button disabled={busy}>Lưu</button>
                  <button type="button" onClick={() => setEditing(null)}>
                    Hủy
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {row.name} · {row.visible ? "Hiện" : "Ẩn"}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditing(row);
                      setEditName(row.name);
                      setEditParent(row.parentId ?? "");
                    }}
                  >
                    Sửa
                  </button>
                  <button
                    onClick={async () => {
                      setError("");
                      try {
                        await onSave(
                          { name: row.name, parentId: row.parentId, visible: !row.visible },
                          row,
                        );
                      } catch (cause) {
                        setError(normalizeFormError(cause));
                      }
                    }}
                  >
                    {row.visible ? "Ẩn danh mục" : "Hiện lại"}
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
