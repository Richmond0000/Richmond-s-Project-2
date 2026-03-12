import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, BedDouble, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format, differenceInHours } from "date-fns";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from "recharts";

const SLEEP_GOAL = 8;

export default function Sleep() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bedtime, setBedtime] = useState("");
  const [wakeTime, setWakeTime] = useState("");

  const { data: sleepLogs } = useQuery({
    queryKey: ["sleep_logs", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("sleep_logs")
        .select("*")
        .eq("user_id", user!.id)
        .order("bedtime", { ascending: false })
        .limit(14);
      return data ?? [];
    },
    enabled: !!user,
  });

  const addLog = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("sleep_logs").insert({
        user_id: user!.id,
        bedtime: new Date(bedtime).toISOString(),
        wake_time: new Date(wakeTime).toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sleep_logs"] });
      setDialogOpen(false);
      setBedtime("");
      setWakeTime("");
      toast.success("Sleep logged!");
    },
    onError: (e) => toast.error(e.message),
  });

  const last7 = sleepLogs?.slice(0, 7).reverse() ?? [];
  const avgSleep = last7.length ? last7.reduce((s, l) => s + Number(l.duration_hours ?? 0), 0) / last7.length : 0;
  const belowGoal = avgSleep > 0 && avgSleep < SLEEP_GOAL - 1;

  const chartData = last7.map((log) => ({
    day: format(new Date(log.bedtime), "EEE"),
    hours: Number(Number(log.duration_hours ?? 0).toFixed(1)),
  }));

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Sleep Tracker</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1"><Plus className="h-4 w-4" /> Log Sleep</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Log Sleep</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); addLog.mutate(); }} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Bedtime</Label>
                <Input type="datetime-local" value={bedtime} onChange={(e) => setBedtime(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Wake Time</Label>
                <Input type="datetime-local" value={wakeTime} onChange={(e) => setWakeTime(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={addLog.isPending}>Log Sleep</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card className="shadow-[var(--shadow-card)]">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <BedDouble className="h-4 w-4 text-[hsl(var(--rest))]" />
              <span className="text-xs text-muted-foreground">Avg Sleep</span>
            </div>
            <p className="text-2xl font-bold">{avgSleep.toFixed(1)}h</p>
          </CardContent>
        </Card>
        <Card className="shadow-[var(--shadow-card)]">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-muted-foreground">Goal</span>
            </div>
            <p className="text-2xl font-bold">{SLEEP_GOAL}h</p>
          </CardContent>
        </Card>
        {belowGoal && (
          <Card className="shadow-[var(--shadow-card)] border-destructive/30 col-span-2 md:col-span-1">
            <CardContent className="p-4 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
              <p className="text-sm text-destructive">You're consistently under-sleeping. Try to get more rest!</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Chart */}
      <Card className="shadow-[var(--shadow-card)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Last 7 Days</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="day" className="text-xs" />
                <YAxis domain={[0, 12]} className="text-xs" />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                />
                <ReferenceLine y={SLEEP_GOAL} stroke="hsl(var(--primary))" strokeDasharray="5 5" label={{ value: "Goal", position: "right", fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <Bar dataKey="hours" fill="hsl(var(--rest))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-12">No sleep data yet. Start logging!</p>
          )}
        </CardContent>
      </Card>

      {/* Recent Logs */}
      <Card className="shadow-[var(--shadow-card)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Recent Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {sleepLogs?.slice(0, 7).map((log) => (
              <div key={log.id} className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/50">
                <div>
                  <p className="text-sm font-medium">{format(new Date(log.bedtime), "MMM d")}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(log.bedtime), "h:mm a")} → {format(new Date(log.wake_time), "h:mm a")}
                  </p>
                </div>
                <span className="text-sm font-bold text-[hsl(var(--rest))]">
                  {Number(log.duration_hours ?? 0).toFixed(1)}h
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
