import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const HOURS = Array.from({ length: 16 }, (_, i) => i + 6); // 6am to 9pm

export default function Schedule() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedDay, setSelectedDay] = useState(new Date().getDay());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: "", day_of_week: 0, start_time: "09:00", end_time: "10:00", category_id: "" });

  const { data: events } = useQuery({
    queryKey: ["schedule_events", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("schedule_events")
        .select("*, categories(*)")
        .eq("user_id", user!.id)
        .order("start_time");
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

  const addEvent = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("schedule_events").insert({
        user_id: user!.id,
        title: newEvent.title,
        day_of_week: newEvent.day_of_week,
        start_time: newEvent.start_time,
        end_time: newEvent.end_time,
        category_id: newEvent.category_id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule_events"] });
      setDialogOpen(false);
      setNewEvent({ title: "", day_of_week: 0, start_time: "09:00", end_time: "10:00", category_id: "" });
      toast.success("Event added!");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteEvent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("schedule_events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule_events"] });
      toast.success("Event removed");
    },
  });

  const dayEvents = events?.filter((e) => e.day_of_week === selectedDay) ?? [];

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Schedule</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1">
              <Plus className="h-4 w-4" /> Add Event
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Schedule Event</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => { e.preventDefault(); addEvent.mutate(); }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input value={newEvent.title} onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Day</Label>
                  <Select value={String(newEvent.day_of_week)} onValueChange={(v) => setNewEvent({ ...newEvent, day_of_week: Number(v) })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DAYS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <Select value={newEvent.category_id} onValueChange={(v) => setNewEvent({ ...newEvent, category_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {categories?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.emoji} {c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Start Time</Label>
                  <Input type="time" value={newEvent.start_time} onChange={(e) => setNewEvent({ ...newEvent, start_time: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>End Time</Label>
                  <Input type="time" value={newEvent.end_time} onChange={(e) => setNewEvent({ ...newEvent, end_time: e.target.value })} />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={addEvent.isPending}>Add Event</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Day Selector */}
      <div className="flex gap-1 overflow-x-auto pb-2">
        {DAYS.map((d, i) => (
          <Button
            key={i}
            variant={selectedDay === i ? "default" : "outline"}
            size="sm"
            className="shrink-0"
            onClick={() => setSelectedDay(i)}
          >
            {d.slice(0, 3)}
          </Button>
        ))}
      </div>

      {/* Timeline */}
      <Card className="shadow-[var(--shadow-card)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">{DAYS[selectedDay]}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative space-y-1">
            {HOURS.map((hour) => {
              const hourEvents = dayEvents.filter((e) => {
                const startH = parseInt(e.start_time?.split(":")[0] ?? "0");
                return startH === hour;
              });
              return (
                <div key={hour} className="flex gap-3 min-h-[48px]">
                  <span className="text-xs text-muted-foreground w-12 pt-1 text-right shrink-0">
                    {hour.toString().padStart(2, "0")}:00
                  </span>
                  <div className="flex-1 border-t border-border/50 pt-1 space-y-1">
                    {hourEvents.map((event) => (
                      <div
                        key={event.id}
                        className="flex items-center justify-between p-2 rounded-md text-sm"
                        style={{
                          backgroundColor: `${(event.categories as any)?.color ?? "hsl(var(--primary))"}20`,
                          borderLeft: `3px solid ${(event.categories as any)?.color ?? "hsl(var(--primary))"}`,
                        }}
                      >
                        <div>
                          <span className="font-medium">{event.title}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {event.start_time?.slice(0, 5)} – {event.end_time?.slice(0, 5)}
                          </span>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteEvent.mutate(event.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
