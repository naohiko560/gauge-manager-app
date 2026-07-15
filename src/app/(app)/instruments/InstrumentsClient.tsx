"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { createClient } from "@/lib/supabase/client";
import { useIsAdmin } from "@/lib/AuthContext";
import { Instrument, MeasurementName, MeasurementModel } from "@/types/database";
import { Card, CardContent } from "@/components/ui/card";
import { PageTitle } from "@/components/ui/PageTitle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Wrench, Trash2, ChevronDown } from "lucide-react";
import { SortableHead } from "@/components/ui/SortableHead";
import { useSortTable, sortRows } from "@/hooks/useSortTable";

function genMgmtCode(): string {
  return crypto.randomUUID();
}

type GroupedInstrument = {
  key: string;
  name_id: string;
  model_id: string | null;
  name: string;
  model: string | null;
  optimalQty: number;
  maker: string;
  calibrationCycleMonths: number;
  records: Instrument[];
};

type FormData = {
  name_id: string;
  model_id: string;    // 既存モデルのID（新規入力時は空）
  modelInput: string;  // テキスト入力値
  maker: string;
  optimal_quantity: string;
  calibration_cycle_months: string;
};

const emptyForm = (): FormData => ({
  name_id: "",
  model_id: "",
  modelInput: "",
  maker: "",
  optimal_quantity: "1",
  calibration_cycle_months: "12",
});

type MasterPayload = {
  instruments: Instrument[];
  names: Pick<MeasurementName, "id" | "name" | "internal_cycle_months">[];
  models: Pick<MeasurementModel, "id" | "name_id" | "model">[];
};

async function fetchInstrumentsMaster(): Promise<MasterPayload> {
  const supabase = createClient();
  const [instrResult, namesResult, modelsResult] = await Promise.all([
    supabase
      .from("instruments")
      .select(
        "id, management_code, name_id, model_id, maker, optimal_quantity, status, stock_quantity, storage_location, updated_at, measurement_names(name, internal_cycle_months), measurement_models(model)"
      )
      .neq("status", "disposed")
      .order("management_code"),
    supabase.from("measurement_names").select("id, name, internal_cycle_months").order("name"),
    supabase.from("measurement_models").select("id, name_id, model").order("model"),
  ]);
  return {
    instruments: (instrResult.data ?? []) as unknown as Instrument[],
    names: namesResult.data ?? [],
    models: modelsResult.data ?? [],
  };
}

function buildGroups(instruments: Instrument[]): GroupedInstrument[] {
  const map = new Map<string, GroupedInstrument>();
  for (const inst of instruments) {
    const key = `${inst.name_id}__${inst.model_id ?? ""}`;
    const existing = map.get(key);
    if (existing) {
      existing.optimalQty = Math.max(existing.optimalQty, inst.optimal_quantity);
      existing.records.push(inst);
    } else {
      map.set(key, {
        key,
        name_id: inst.name_id,
        model_id: inst.model_id,
        name: (inst as any).measurement_names?.name ?? "-",
        model: (inst as any).measurement_models?.model ?? null,
        optimalQty: inst.optimal_quantity,
        maker: inst.maker,
        calibrationCycleMonths: (inst as any).measurement_names?.internal_cycle_months ?? 12,
        records: [inst],
      });
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => a.name.localeCompare(b.name) || (a.model ?? "").localeCompare(b.model ?? "")
  );
}

export function InstrumentsClient() {
  const router = useRouter();
  const isAdmin = useIsAdmin();
  const { data, isLoading, mutate } = useSWR<MasterPayload>(
    "instruments-master",
    fetchInstrumentsMaster,
    { revalidateOnFocus: false, dedupingInterval: 600_000 }
  );
  const instruments = data?.instruments ?? [];
  const names = data?.names ?? [];
  const models = data?.models ?? [];
  const [open, setOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<GroupedInstrument | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm());
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [disposeConfirm, setDisposeConfirm] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [modelShowAll, setModelShowAll] = useState(false);
  const [modelHighlight, setModelHighlight] = useState(-1);
  const modelContainerRef = useRef<HTMLDivElement>(null);
  const modelInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isAdmin) router.replace("/dashboard");
  }, [isAdmin, router]);

  const { sortKey, sortDir, handleSort } = useSortTable("name");
  const groups = sortRows(buildGroups(instruments), sortKey, sortDir);
  const filteredModels = form.name_id ? models.filter((m) => m.name_id === form.name_id) : models;

  const modelSuggestions = modelShowAll
    ? filteredModels
    : form.modelInput.trim()
      ? filteredModels.filter((m) =>
          m.model.toLowerCase().includes(form.modelInput.toLowerCase())
        )
      : [];

  function flash(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 3000);
  }

  function openNew() {
    setEditingGroup(null);
    setForm(emptyForm());
    setError("");
    setOpen(true);
  }

  function openEdit(group: GroupedInstrument) {
    setEditingGroup(group);
    setForm({
      name_id: group.name_id,
      model_id: group.model_id ?? "",
      modelInput: group.model ?? "",
      maker: group.maker,
      optimal_quantity: group.optimalQty.toString(),
      calibration_cycle_months: group.calibrationCycleMonths.toString(),
    });
    setError("");
    setOpen(true);
  }

  function set(key: keyof FormData, value: string) {
    if (key === "name_id") {
      const nameEntry = names.find((n) => n.id === value);
      setForm((prev) => ({
        ...prev,
        name_id: value,
        model_id: "",
        modelInput: "",
        calibration_cycle_months: (nameEntry?.internal_cycle_months ?? 12).toString(),
      }));
    } else {
      setForm((prev) => ({ ...prev, [key]: value }));
    }
  }

  async function handleSave() {
    if (!form.name_id) {
      setError("測定器名は必須です");
      return;
    }

    setSaving(true);
    setError("");
    const supabase = createClient();

    // 型式の解決：入力テキストからIDを確定（必要なら新規作成）
    let resolvedModelId: string | null = null;
    const modelText = form.modelInput.trim();
    if (modelText) {
      if (form.model_id) {
        resolvedModelId = form.model_id;
      } else {
        const existing = models.find(
          (m) => m.name_id === form.name_id && m.model === modelText
        );
        if (existing) {
          resolvedModelId = existing.id;
        } else {
          const { data: newModel, error: modelErr } = await supabase
            .from("measurement_models")
            .insert({ name_id: form.name_id, model: modelText })
            .select("id, name_id, model")
            .single();
          if (modelErr) { setError("型式の登録に失敗しました: " + modelErr.message); setSaving(false); return; }
          resolvedModelId = newModel.id;
        }
      }
    }

    const newOptimal = parseInt(form.optimal_quantity) || 1;
    const newCycleMonths = Math.max(1, parseInt(form.calibration_cycle_months) || 12);

    // 校正周期をmeasurement_namesに保存
    await supabase
      .from("measurement_names")
      .update({ internal_cycle_months: newCycleMonths })
      .eq("id", form.name_id);

    if (editingGroup) {
      const ids = editingGroup.records.map((r) => r.id);
      const { error: err } = await supabase
        .from("instruments")
        .update({ maker: form.maker, optimal_quantity: newOptimal, updated_at: new Date().toISOString() })
        .in("id", ids);
      if (err) { setError(err.message); setSaving(false); return; }
    } else {
      const duplicate = groups.some(
        (g) => g.name_id === form.name_id && (g.model_id ?? null) === resolvedModelId
      );
      if (duplicate) {
        setError("この測定器名・型式の組み合わせはすでに登録されています");
        setSaving(false);
        return;
      }

      const { error: err } = await supabase
        .from("instruments")
        .insert({
          management_code: genMgmtCode(),
          name_id: form.name_id,
          model_id: resolvedModelId,
          maker: form.maker,
          optimal_quantity: newOptimal,
          storage_location: "倉庫",
          stock_quantity: 0,
          status: "in_stock",
          updated_at: new Date().toISOString(),
        });
      if (err) { setError(err.message); setSaving(false); return; }
    }

    await mutate();
    setSaving(false);
    setOpen(false);
    flash(editingGroup ? "更新しました" : "登録しました");
  }

  async function handleDispose() {
    if (!editingGroup) return;
    setDeleting(true);
    const supabase = createClient();
    const ids = editingGroup.records.map((r) => r.id);
    const { error: err } = await supabase
      .from("instruments")
      .update({ status: "disposed", updated_at: new Date().toISOString() })
      .in("id", ids);
    setDeleting(false);
    if (err) { setError(err.message); return; }
    await mutate();
    setOpen(false);
    setDisposeConfirm(false);
    flash("削除しました");
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <PageTitle>【管理】機器マスター</PageTitle>
          <p className="text-sm text-gray-500 mt-1">全 {groups.length} 種類</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="w-4 h-4 mr-2" /> 新規登録
        </Button>
      </div>

      {successMsg && (
        <Alert className="bg-green-50 border-green-200">
          <AlertDescription className="text-green-700">{successMsg}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead sortKey="name" currentKey={sortKey} currentDir={sortDir} onSort={handleSort}>測定器名</SortableHead>
                <SortableHead sortKey="model" currentKey={sortKey} currentDir={sortDir} onSort={handleSort}>型式</SortableHead>
                <SortableHead sortKey="maker" currentKey={sortKey} currentDir={sortDir} onSort={handleSort}>メーカー</SortableHead>
                <SortableHead sortKey="optimalQty" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-center">適正数</SortableHead>
                <SortableHead sortKey="calibrationCycleMonths" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-center">校正周期</SortableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-gray-400">
                    測定器が登録されていません
                  </TableCell>
                </TableRow>
              ) : (
                groups.map((group) => (
                  <TableRow
                    key={group.key}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => openEdit(group)}
                  >
                    <TableCell className="font-medium">{group.name}</TableCell>
                    <TableCell className="text-sm text-gray-600">{group.model ?? "-"}</TableCell>
                    <TableCell className="text-sm">{group.maker || "-"}</TableCell>
                    <TableCell className="text-center text-gray-500">{group.optimalQty}</TableCell>
                    <TableCell className="text-center text-gray-500">{group.calibrationCycleMonths}ヶ月</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 登録・編集ダイアログ */}
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setDisposeConfirm(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="w-4 h-4" />
              {editingGroup ? "測定器を編集" : "測定器を新規登録"}
            </DialogTitle>
          </DialogHeader>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">測定器名 *</Label>
                <Select
                  value={form.name_id}
                  onValueChange={(v) => set("name_id", v ?? "")}
                  disabled={!!editingGroup}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="選択">
                      {form.name_id
                        ? names.find((n) => n.id === form.name_id)?.name ?? "選択"
                        : "選択"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {names.map((n) => (
                      <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 relative" ref={modelContainerRef}>
                <Label className="text-xs">型式</Label>
                <div className="relative">
                  <Input
                    ref={modelInputRef}
                    value={form.modelInput}
                    disabled={!!editingGroup}
                    autoComplete="off"
                    placeholder={form.name_id ? "型式を入力" : "名称を先に選択"}
                    className="pr-8"
                    onChange={(e) => {
                      setForm((prev) => ({ ...prev, modelInput: e.target.value, model_id: "" }));
                      setModelShowAll(false);
                      setModelHighlight(0);
                      setModelOpen(e.target.value.trim().length > 0);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        if (!modelOpen) {
                          setModelShowAll(true);
                          setModelOpen(true);
                          setModelHighlight(0);
                        } else {
                          setModelHighlight((prev) => Math.min(prev + 1, modelSuggestions.length - 1));
                        }
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        if (modelOpen) setModelHighlight((prev) => Math.max(prev - 1, 0));
                      } else if (e.key === "Enter" && modelOpen) {
                        e.preventDefault();
                        const sel = modelSuggestions[modelHighlight] ?? modelSuggestions[0];
                        if (sel) setForm((prev) => ({ ...prev, model_id: sel.id, modelInput: sel.model }));
                        setModelOpen(false);
                        setModelShowAll(false);
                        setModelHighlight(-1);
                      } else if (e.key === "Escape") {
                        setModelOpen(false);
                        setModelHighlight(-1);
                      }
                    }}
                    onBlur={(e) => {
                      if (!modelContainerRef.current?.contains(e.relatedTarget as Node)) {
                        setModelOpen(false);
                        setModelShowAll(false);
                        setModelHighlight(-1);
                      }
                    }}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    disabled={!!editingGroup || !form.name_id}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      if (modelOpen && modelShowAll) {
                        setModelOpen(false);
                        setModelShowAll(false);
                        setModelHighlight(-1);
                      } else {
                        setModelShowAll(true);
                        setModelOpen(true);
                        setModelHighlight(0);
                        modelInputRef.current?.focus();
                      }
                    }}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
                {modelOpen && modelSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {modelSuggestions.map((m, i) => (
                      <button
                        key={m.id}
                        type="button"
                        className={`w-full text-left px-3 py-2 text-sm ${i === modelHighlight ? "bg-gray-100" : "hover:bg-gray-50"}`}
                        onMouseDown={(e) => e.preventDefault()}
                        onMouseEnter={() => setModelHighlight(i)}
                        onClick={() => {
                          setForm((prev) => ({ ...prev, model_id: m.id, modelInput: m.model }));
                          setModelOpen(false);
                          setModelShowAll(false);
                          setModelHighlight(-1);
                          modelInputRef.current?.focus();
                        }}
                      >
                        {m.model}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">メーカー</Label>
                <Input value={form.maker} onChange={(e) => set("maker", e.target.value)} disabled={!!editingGroup} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">適正数</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.optimal_quantity}
                  onChange={(e) => set("optimal_quantity", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">校正周期（ヶ月）</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.calibration_cycle_months}
                  onChange={(e) => set("calibration_cycle_months", Math.max(1, parseInt(e.target.value) || 1).toString())}
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              {saving ? "保存中..." : "保存する"}
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)}>
              キャンセル
            </Button>
          </div>

          {editingGroup && (
            <div className="border-t pt-3 mt-1">
              {disposeConfirm ? (
                <div className="space-y-2">
                  <p className="text-sm text-red-600">本当に削除しますか？この操作は元に戻せません。</p>
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      className="flex-1"
                      onClick={handleDispose}
                      disabled={deleting}
                    >
                      {deleting ? "処理中..." : "削除する"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setDisposeConfirm(false)}>
                      キャンセル
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-500 hover:text-red-700 hover:bg-red-50 w-full"
                  onClick={() => setDisposeConfirm(true)}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  この機器を削除する
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
