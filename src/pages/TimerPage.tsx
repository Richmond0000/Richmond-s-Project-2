import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Play, Pause, RotateCcw, Coffee } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function TimerPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [focusMin, setFocusMin] = useState(25);
  const [breakMin, setBreakMin] = useState(5);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  const intervalRef = useRef<number | null>(null);

  const { data: todaySessions } = useQuery({
    queryKey: ["pomodoro_sessions", user?.id, format(new Date(), "yyyy-MM-dd")],
    queryFn: async () => {
      const { data } = await supabase
        .from("pomodoro_sessions")
        .select("*")
        .eq("user_id", user!.id)
        .eq("session_date", format(new Date(), "yyyy-MM-dd"));
      return data ?? [];
    },
    enabled: !!user,
  });

  const saveSessions = useMutation({
    mutationFn: async (count: number) => {
      const today = format(new Date(), "yyyy-MM-dd");
      const existing = todaySessions?.[0];
      if (existing) {
        await supabase.from("pomodoro_sessions").update({ completed_sessions: count }).eq("id", existing.id);
      } else {
        await supabase.from("pomodoro_sessions").insert({
          user_id: user!.id,
          focus_minutes: focusMin,
          break_minutes: breakMin,
          completed_sessions: count,
          session_date: today,
        });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pomodoro_sessions"] }),
  });

  const tick = useCallback(() => {
    setSecondsLeft((prev) => {
      if (prev <= 1) {
        if (!isBreak) {
          const newCount = sessionsCompleted + 1;
          setSessionsCompleted(newCount);
          saveSessions.mutate(newCount);
          toast.success("Focus session complete! Time for a break 🎉");
          setIsBreak(true);
          return breakMin * 60;
        } else {
          toast.info("Break's over! Ready to focus? 💪");
          setIsBreak(false);
          setIsRunning(false);
          return focusMin * 60;
        }
      }
      return prev - 1;
    });
  }, [isBreak, sessionsCompleted, breakMin, focusMin, saveSessions]);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = window.setInterval(tick, 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning, tick]);

  const reset = () => {
    setIsRunning(false);
    setIsBreak(false);
    setSecondsLeft(focusMin * 60);
  };

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const progress = isBreak
    ? ((breakMin * 60 - secondsLeft) / (breakMin * 60)) * 100
    : ((focusMin * 60 - secondsLeft) / (focusMin * 60)) * 100;

  const totalToday = todaySessions?.reduce((s, p) => s + p.completed_sessions, 0) ?? 0;

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold tracking-tight">Study Timer</h1>

      {/* Timer Circle */}
      <Card className="shadow-[var(--shadow-elevated)]">
        <CardContent className="p-8 flex flex-col items-center">
          <div className="relative w-56 h-56 mb-6">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="44" fill="none" stroke="hsl(var(--secondary))" strokeWidth="6" />
              <circle
                cx="50" cy="50" r="44" fill="none"
                stroke={isBreak ? "hsl(var(--accent))" : "hsl(var(--primary))"}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 44}`}
                strokeDashoffset={`${2 * Math.PI * 44 * (1 - progress / 100)}`}
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-bold font-[Space_Grotesk] tracking-wider">
                {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
              </span>
              <span className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                {isBreak ? <><Coffee className="h-3 w-3" /> Break</> : "Focus"}
              </span>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              size="lg"
              onClick={() => setIsRunning(!isRunning)}
              className="gap-2 min-w-[120px]"
            >
              {isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {isRunning ? "Pause" : "Start"}
            </Button>
            <Button size="lg" variant="outline" onClick={reset}>
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Settings & Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="shadow-[var(--shadow-card)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Focus (min)</Label>
              <Input
                type="number" min={1} max={120} value={focusMin}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setFocusMin(v);
                  if (!isRunning && !isBreak) setSecondsLeft(v * 60);
                }}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Break (min)</Label>
              <Input type="number" min={1} max={30} value={breakMin} onChange={(e) => setBreakMin(Number(e.target.value))} />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-[var(--shadow-card)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Today</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-primary">{totalToday + sessionsCompleted}</p>
            <p className="text-xs text-muted-foreground mt-1">sessions completed</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
