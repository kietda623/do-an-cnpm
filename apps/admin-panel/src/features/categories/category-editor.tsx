"use client";

import { useState, type FormEvent } from "react";
import {
  Badge,
  Button,
  DataTable,
  Dialog,
  Panel,
  SelectField,
  TextField,
  type DataTableColumn,
} from "@marketplace/ui-web";
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

const flatten = (
  items: CategoryRow[],
  depth = 0,
): Array<{ row: CategoryRow; depth: number }> =>
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

  async function toggleVisible(row: CategoryRow) {
    setError("");
    try {
      await onSave({ name: row.name, parentId: row.parentId, visible: !row.visible }, row);
    } catch (cause) {
      setError(normalizeFormError(cause));
    }
  }

  const columns: DataTableColumn<{ row: CategoryRow; depth: number }>[] = [
    {
      key: "name",
      header: "Danh mục",
      render: ({ row, depth }) => (
        <span style={{ paddingLeft: depth * 18 }}>
          {`${row.name} · ${row.visible ? "Hiện" : "Ẩn"}`}
        </span>
      ),
    },
    {
      key: "visible",
      header: "Hiển thị",
      render: ({ row }) => (
        <Badge tone={row.visible ? "success" : "warning"}>
          {row.visible ? "Đang hiển thị" : "Đang ẩn"}
        </Badge>
      ),
    },
    {
      key: "version",
      header: "Phiên bản",
      align: "right",
      render: ({ row }) => <span className="mp-muted">v{row.version}</span>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: ({ row }) => (
        <span className="mp-table__actions">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setEditing(row);
              setEditName(row.name);
              setEditParent(row.parentId ?? "");
            }}
          >
            Sửa
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void toggleVisible(row)}>
            {row.visible ? "Ẩn danh mục" : "Hiện lại"}
          </Button>
        </span>
      ),
    },
  ];

  return (
    <div className="mp-stack mp-admin-category-editor">
      <Panel title="Tạo danh mục" description="Thêm danh mục gốc hoặc danh mục con.">
        <form className="mp-form" onSubmit={submit} aria-label="Tạo danh mục">
          <div className="mp-form-grid">
            <TextField
              label="Tên danh mục"
              name="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              maxLength={120}
            />
            <SelectField
              label="Danh mục cha"
              name="parentId"
              value={parentId}
              onChange={(event) => setParentId(event.target.value)}
            >
              <option value="">Không có</option>
              {options.map(({ row, depth }) => (
                <option key={row.id} value={row.id}>
                  {"— ".repeat(depth)}
                  {row.name}
                </option>
              ))}
            </SelectField>
          </div>
          <div className="mp-form-actions">
            <Button type="submit" loading={busy}>
              {busy ? "Đang lưu…" : "Tạo danh mục"}
            </Button>
          </div>
        </form>
      </Panel>

      <Panel title="Cây danh mục" description={`${options.length} danh mục`} flush>
        <DataTable
          columns={columns}
          rows={options}
          rowKey={({ row }) => row.id}
          caption="Cây danh mục"
          empty={
            <div className="mp-panel__pad">
              <p className="mp-muted">Chưa có danh mục nào. Tạo danh mục đầu tiên ở trên.</p>
            </div>
          }
        />
      </Panel>

      {error ? (
        <p role="alert" className="mp-alert-inline">
          {error}
        </p>
      ) : null}

      <Dialog
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Sửa danh mục"
        description={editing ? `v${editing.version}` : undefined}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Hủy
            </Button>
            <Button type="submit" form="category-edit-form" loading={busy}>
              Lưu
            </Button>
          </>
        }
      >
        {editing ? (
          <form id="category-edit-form" className="mp-form" onSubmit={saveEdit}>
            <TextField
              label="Tên danh mục"
              name="edit-name"
              value={editName}
              onChange={(event) => setEditName(event.target.value)}
              required
              maxLength={120}
            />
            <SelectField
              label="Danh mục cha"
              name="edit-parent"
              value={editParent}
              onChange={(event) => setEditParent(event.target.value)}
            >
              <option value="">Không có</option>
              {options
                .filter(
                  ({ row: option }) =>
                    option.id !== editing.id && !descendants(editing).has(option.id),
                )
                .map(({ row: option, depth }) => (
                  <option key={option.id} value={option.id}>
                    {"— ".repeat(depth)}
                    {option.name}
                  </option>
                ))}
            </SelectField>
          </form>
        ) : null}
      </Dialog>
    </div>
  );
}
