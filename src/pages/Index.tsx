import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckSquare, Calendar, Timer, BedDouble, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";

export default function Dashboard() {
  const { user } = useAuth();
  const [view, setView] = useState<"daily" | "weekly">("daily");
  const today = new Date();
  const dayOfWeek = today.getDay();

  const { data: tasks } = useQuery({
    queryKey: ["tasks", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", user!.id)
        .order("due_date", { ascending: true });
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: todayEvents } = useQuery({
    queryKey: ["schedule_events", user?.id, dayOfWeek],
    queryFn: async () => {
      const { data } = await supabase
        .from("schedule_events")
        .select("*, categories(*)")
        .eq("user_id", user!.id)
        .eq("day_of_week", dayOfWeek)
        .order("start_time", { ascending: true });
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: sleepLogs } = useQuery({
    queryKey: ["sleep_logs", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("sleep_logs")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(7);
      return data ?? [];
    },
    enabled: !!user,
  });

  const pendingTasks = tasks?.filter((t) => !t.is_completed) ?? [];
  const overdueTasks = pendingTasks.filter((t) => t.due_date && new Date(t.due_date) < today);
  const avgSleep = sleepLogs?.length
    ? sleepLogs.reduce((sum, l) => sum + Number(l.duration_hours ?? 0), 0) / sleepLogs.length
    : 0;

  const greeting = () => {
    const hour = today.getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            {greeting()} 👋
          </h1>
          <p className="text-muted-foreground">{format(today, "EEEE, MMMM d")}</p>
        </div>
        <div className="flex gap-1 bg-secondary rounded-lg p-1">
          <Button
            variant={view === "daily" ? "default" : "ghost"}
            size="sm"
            onClick={() => setView("daily")}
          >
            Day
          </Button>
          <Button
            variant={view === "weekly" ? "default" : "ghost"}
            size="sm"
            onClick={() => setView("weekly")}
          >
            Week
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={CheckSquare} label="Pending Tasks" value={String(pendingTasks.length)} color="text-primary" />
        <StatCard icon={Calendar} label="Today's Events" value={String(todayEvents?.length ?? 0)} color="text-accent" />
        <StatCard icon={Timer} label="Overdue" value={String(overdueTasks.length)} color="text-destructive" />
        <StatCard icon={BedDouble} label="Avg Sleep" value={`${avgSleep.toFixed(1)}h`} color="text-[hsl(var(--rest))]" />
      </div>

      {/* Today's Schedule */}
      <Card className="shadow-[var(--shadow-card)]">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg">
            {view === "daily" ? "Today's Schedule" : "This Week"}
          </CardTitle>
          <Link to="/schedule">
            <Button variant="ghost" size="sm" className="gap-1">
              View all <ChevronRight className="h-3 w-3" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {todayEvents && todayEvents.length > 0 ? (
            <div className="space-y-2">
              {todayEvents.slice(0, view === "daily" ? 5 : 10).map((event) => (
                <div key={event.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-secondary/50">
                  <div
                    className="w-1 h-10 rounded-full"
                    style={{ backgroundColor: (event.categories as any)?.color ?? "hsl(var(--primary))" }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{event.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {event.start_time?.slice(0, 5)} – {event.end_time?.slice(0, 5)}
                    </p>
                  </div>
                  <span className="text-xs">{(event.categories as any)?.emoji}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No events scheduled. <Link to="/schedule" className="text-primary hover:underline">Add one</Link>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Upcoming Tasks */}
      <Card className="shadow-[var(--shadow-card)]">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg">Upcoming Tasks</CardTitle>
          <Link to="/tasks">
            <Button variant="ghost" size="sm" className="gap-1">
              View all <ChevronRight className="h-3 w-3" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {pendingTasks.length > 0 ? (
            <div className="space-y-2">
              {pendingTasks.slice(0, 5).map((task) => (
                <div key={task.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-secondary/50">
                  <div className={`w-2 h-2 rounded-full ${
                    task.priority === "high" ? "bg-destructive" : task.priority === "medium" ? "bg-[hsl(var(--classes))]" : "bg-[hsl(var(--exercise))]"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{task.title}</p>
                    {task.due_date && (
                      <p className="text-xs text-muted-foreground">
                        Due {format(new Date(task.due_date), "MMM d")}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-6 text-center">
              All caught up! <Link to="/tasks" className="text-primary hover:underline">Add a task</Link>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <Card className="shadow-[var(--shadow-card)]">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <Icon className={`h-4 w-4 ${color}`} />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <p className="text-2xl font-bold tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
}
