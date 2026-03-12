import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function Tasks() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "completed">("pending");
  const [newTask, setNewTask] = useState({ title: "", due_date: "", priority: "medium", category_id: "" });

  const { data: tasks } = useQuery({
    queryKey: ["tasks", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("*, categories(*)")
        .eq("user_id", user!.id)
        .order("due_date", { ascending: true, nullsFirst: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: categories } = useQuery({
    queryKey: ["categories", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("*").eq("user_id", user!.id);
      return data ?? [];
    },
    enabled: !!user,
  });

  const addTask = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("tasks").insert({
        user_id: user!.id,
        title: newTask.title,
        due_date: newTask.due_date || null,
        priority: newTask.priority,
        category_id: newTask.category_id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setDialogOpen(false);
      setNewTask({ title: "", due_date: "", priority: "medium", category_id: "" });
      toast.success("Task added!");
    },
    onError: (e) => toast.error(e.message),
  });

  const toggleTask = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await supabase
        .from("tasks")
        .update({ is_completed: completed, completed_at: completed ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task deleted");
    },
  });

  const filtered = tasks?.filter((t) => {
    if (filter === "pending") return !t.is_completed;
    if (filter === "completed") return t.is_completed;
    return true;
  }) ?? [];

  const isOverdue = (date: string | null) => date && new Date(date) < new Date() ;

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1"><Plus className="h-4 w-4" /> Add Task</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Task</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); addTask.mutate(); }} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Due Date</Label>
                  <Input type="datetime-local" value={newTask.due_date} onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Priority</Label>
                  <Select value={newTask.priority} onValueChange={(v) => setNewTask({ ...newTask, priority: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">🟢 Low</SelectItem>
                      <SelectItem value="medium">🟡 Medium</SelectItem>
                      <SelectItem value="high">🔴 High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={newTask.category_id} onValueChange={(v) => setNewTask({ ...newTask, category_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>
                    {categories?.map((c) => <SelectItem key={c.id} value={c.id}>{c.emoji} {c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={addTask.isPending}>Add Task</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter */}
      <div className="flex gap-1 bg-secondary rounded-lg p-1 w-fit">
        {(["pending", "all", "completed"] as const).map((f) => (
          <Button key={f} variant={filter === f ? "default" : "ghost"} size="sm" onClick={() => setFilter(f)} className="capitalize">
            {f}
          </Button>
        ))}
      </div>

      {/* Task List */}
      <div className="space-y-2">
        {filtered.map((task) => (
          <Card key={task.id} className={cn("shadow-[var(--shadow-card)] transition-opacity", task.is_completed && "opacity-60")}>
            <CardContent className="p-3 flex items-center gap-3">
              <Checkbox
                checked={task.is_completed}
                onCheckedChange={(checked) => toggleTask.mutate({ id: task.id, completed: !!checked })}
              />
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm font-medium truncate", task.is_completed && "line-through")}>{task.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {task.due_date && (
                    <span className={cn("text-xs", isOverdue(task.due_date) && !task.is_completed ? "text-destructive flex items-center gap-0.5" : "text-muted-foreground")}>
                      {isOverdue(task.due_date) && !task.is_completed && <AlertTriangle className="h-3 w-3" />}
                      {format(new Date(task.due_date), "MMM d, h:mm a")}
                    </span>
                  )}
                  {(task.categories as any)?.name && (
                    <span className="text-xs text-muted-foreground">{(task.categories as any)?.emoji} {(task.categories as any)?.name}</span>
                  )}
                </div>
              </div>
              <div className={cn("w-2 h-2 rounded-full shrink-0", {
                "bg-destructive": task.priority === "high",
                "bg-[hsl(var(--classes))]": task.priority === "medium",
                "bg-[hsl(var(--exercise))]": task.priority === "low",
              })} />
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => deleteTask.mutate(task.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-12">No tasks here ✨</p>
        )}
      </div>
    </div>
  );
}
