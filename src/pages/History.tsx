import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Activity } from "@/types/activity";
import {
  ArrowLeft,
  Loader2,
  Pencil,
  Check,
  X,
  Plus,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { userConfig } from "@/config/userConfig";
import {
  fetchRecentActivities,
  batchUpdateActivities,
  insertActivity,
  formatTimeDisplay,
  formatDateDisplay,
  timeToInput,
  inputToTime,
  dateToInput,
  inputToDate,
  isToday,
  getWinnipegDateString,
  getWinnipegTimeString,
} from "@/lib/api";

const getBgUrl = () => {
  const img = userConfig.backgroundImage;
  if (img.startsWith("http://") || img.startsWith("https://")) return img;
  return `${import.meta.env.BASE_URL}${img}`;
};

interface EditState {
  activity: string;
  date: string;       // YYYY-MM-DD for input
  startTime: string;  // HH:MM for input
  endTime: string;    // HH:MM for input
}

interface AddState {
  activity: string;
  date: string;
  startTime: string;
  endTime: string;
}

const History = () => {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>({ activity: "", date: "", startTime: "", endTime: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addState, setAddState] = useState<AddState>({
    activity: "",
    date: dateToInput(getWinnipegDateString()),
    startTime: "",
    endTime: "",
  });
  const [isAdding, setIsAdding] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchRecentActivities();
      setActivities(data);
    } catch {
      toast({ title: "Failed to load", description: "Check your API URL.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Edit helpers ────────────────────────────────────────────────────────────

  const openEdit = (a: Activity) => {
    setEditingId(a.recordId);
    setEditState({
      activity: a.activity,
      date: dateToInput(a.date),
      startTime: timeToInput(a.startTime),
      endTime: timeToInput(a.endTime),
    });
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async (a: Activity) => {
    if (!editState.activity.trim()) {
      toast({ title: "Activity text required", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      // Build the updates — always update the edited record
      const updates: Array<{ recordId: string } & Partial<Activity>> = [
        {
          recordId: a.recordId,
          activity: editState.activity.trim(),
          date: inputToDate(editState.date),
          startTime: inputToTime(editState.startTime),
          endTime: editState.endTime ? inputToTime(editState.endTime) : "",
          status: editState.endTime ? "Completed" : "Active",
          isActive: !editState.endTime,
        },
      ];

      // Boundary logic: if the user changed end time, also update the next
      // activity's start time to match (keeps the chain intact).
      const originalEndTime = timeToInput(a.endTime);
      const newEndTime = editState.endTime;
      if (newEndTime && newEndTime !== originalEndTime) {
        // activities array is newest-first; find this activity's position
        const idx = activities.findIndex((x) => x.recordId === a.recordId);
        // The chronologically NEXT activity is at idx - 1 in the newest-first list
        if (idx > 0) {
          const nextActivity = activities[idx - 1];
          updates.push({
            recordId: nextActivity.recordId,
            startTime: inputToTime(newEndTime),
          });
        }
      }

      await batchUpdateActivities(updates);
      toast({ title: "Saved", description: "Activity updated." });
      setEditingId(null);
      await load();
    } catch {
      toast({ title: "Save failed", description: "Could not update. Try again.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  // ── Add backdated activity ───────────────────────────────────────────────────

  const handleAdd = async () => {
    if (!addState.activity.trim() || !addState.startTime) {
      toast({ title: "Activity and start time are required.", variant: "destructive" });
      return;
    }
    setIsAdding(true);
    try {
      await insertActivity({
        activity: addState.activity.trim(),
        date: inputToDate(addState.date),
        startTime: inputToTime(addState.startTime),
        endTime: addState.endTime ? inputToTime(addState.endTime) : undefined,
        isActive: false,
        status: "Completed",
      });
      toast({ title: "Activity added" });
      setAddState({
        activity: "",
        date: dateToInput(getWinnipegDateString()),
        startTime: "",
        endTime: "",
      });
      setShowAddForm(false);
      await load();
    } catch {
      toast({ title: "Add failed", description: "Could not insert activity. Try again.", variant: "destructive" });
    } finally {
      setIsAdding(false);
    }
  };

  // ── Rendering ────────────────────────────────────────────────────────────────

  const renderActivityCard = (a: Activity, idx: number) => {
    const isEditing = editingId === a.recordId;
    const active = a.isActive === true || String(a.isActive) === "true";
    const hasEndTime = a.endTime && String(a.endTime) !== "" && String(a.endTime) !== "false";

    return (
      <div
        key={a.recordId}
        className={`border rounded-xl bg-card transition-all duration-200 ${
          isEditing ? "border-primary/50" : "border-foreground/10"
        }`}
      >
        {/* Collapsed view */}
        {!isEditing && (
          <div className="px-4 py-3 flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              {active && (
                <span className="inline-block text-xs text-primary font-medium uppercase tracking-wider mb-1">
                  Active
                </span>
              )}
              <p className="text-foreground text-sm leading-snug">{a.activity}</p>
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
{formatDateDisplay(a.date) && (
  <>
    <span className="text-primary/80">{String(a.date)}</span>
    <span>·</span>
  </>
)}
                <span>
                  {formatTimeDisplay(a.startTime)}
                  {hasEndTime ? ` – ${formatTimeDisplay(a.endTime)}` : ""}
                </span>
              </div>
            </div>
            <button
              onClick={() => openEdit(a)}
              className="shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors mt-0.5"
              title="Edit"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Expanded edit form */}
        {isEditing && (
          <div className="px-4 py-4 space-y-3">
            <p className="text-xs text-primary uppercase tracking-wider font-medium">Editing</p>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Activity</label>
              <textarea
                value={editState.activity}
                onChange={(e) => setEditState((s) => ({ ...s, activity: e.target.value }))}
                className="w-full bg-background border border-foreground/20 rounded-lg p-3 text-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[60px]"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Date</label>
                <input
                  type="date"
                  value={editState.date}
                  onChange={(e) => setEditState((s) => ({ ...s, date: e.target.value }))}
                  className="w-full bg-background border border-foreground/20 rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Start Time</label>
                <input
                  type="time"
                  value={editState.startTime}
                  onChange={(e) => setEditState((s) => ({ ...s, startTime: e.target.value }))}
                  className="w-full bg-background border border-foreground/20 rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">
                End Time
                <span className="ml-1 text-muted-foreground/60">(leave blank if still active)</span>
              </label>
              <input
                type="time"
                value={editState.endTime}
                onChange={(e) => setEditState((s) => ({ ...s, endTime: e.target.value }))}
                className="w-full bg-background border border-foreground/20 rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            {/* If end time changed, show the boundary note */}
            {editState.endTime && editState.endTime !== timeToInput(a.endTime) && idx > 0 && (
              <p className="text-xs text-muted-foreground/70 italic">
                The next activity's start time will also update to match.
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <Button
                onClick={() => saveEdit(a)}
                disabled={isSaving}
                className="flex-1 h-9 text-sm gap-1.5"
                variant="action"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Save
              </Button>
              <Button
                onClick={cancelEdit}
                disabled={isSaving}
                variant="outline"
                className="flex-1 h-9 text-sm gap-1.5"
              >
                <X className="w-3.5 h-3.5" />
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen relative flex flex-col px-4 py-6 max-w-md mx-auto">
      {/* Background */}
      <div
        className="fixed inset-0 -z-20 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${getBgUrl()})` }}
      />
      <div className="fixed inset-0 -z-10 bg-background/80" />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <span className="text-sm font-medium text-foreground">Activity History</span>
        <button
          onClick={() => setShowAddForm((v) => !v)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors border border-foreground/20 rounded-lg px-3 py-1.5"
        >
          {showAddForm ? <ChevronUp className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          Add
        </button>
      </div>

      {/* Add Backdated Activity Form */}
      {showAddForm && (
        <div className="mb-4 border border-primary/30 rounded-xl bg-card px-4 py-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <p className="text-xs text-primary uppercase tracking-wider font-medium">Add Backdated Activity</p>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Activity</label>
            <textarea
              value={addState.activity}
              onChange={(e) => setAddState((s) => ({ ...s, activity: e.target.value }))}
              className="w-full bg-background border border-foreground/20 rounded-lg p-3 text-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[60px]"
              placeholder="What were you doing?"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Date</label>
              <input
                type="date"
                value={addState.date}
                onChange={(e) => setAddState((s) => ({ ...s, date: e.target.value }))}
                className="w-full bg-background border border-foreground/20 rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Start Time *</label>
              <input
                type="time"
                value={addState.startTime}
                onChange={(e) => setAddState((s) => ({ ...s, startTime: e.target.value }))}
                className="w-full bg-background border border-foreground/20 rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">
              End Time
              <span className="ml-1 text-muted-foreground/60">(optional)</span>
            </label>
            <input
              type="time"
              value={addState.endTime}
              onChange={(e) => setAddState((s) => ({ ...s, endTime: e.target.value }))}
              className="w-full bg-background border border-foreground/20 rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button onClick={handleAdd} disabled={isAdding} className="flex-1 h-9 text-sm" variant="action">
              {isAdding ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
              Add Activity
            </Button>
            <Button
              onClick={() => setShowAddForm(false)}
              variant="outline"
              className="flex-1 h-9 text-sm"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Activity List */}
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 text-muted-foreground py-12">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading...
        </div>
      ) : activities.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-12">No activities found.</p>
      ) : (
        <div className="space-y-2">
          {activities.map((a, idx) => renderActivityCard(a, idx))}
        </div>
      )}

      <div className="h-8" />
    </div>
  );
};

export default History;
