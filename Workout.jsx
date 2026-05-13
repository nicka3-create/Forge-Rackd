import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dumbbell, Plus, Save, Loader2, Calendar, Clock, Flame, Trophy } from 'lucide-react';
import ExerciseInput from '@/components/workout/ExerciseInput';
import PlateCalculator from '@/components/workout/PlateCalculator';
import SaveTemplateDialog from '@/components/workout/SaveTemplateDialog';
import LoadTemplateSheet from '@/components/workout/LoadTemplateSheet';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { checkAndAwardBadges } from '@/hooks/useAchievements';

const moods = [
  { value: 'amazing', emoji: '🔥' },
  { value: 'good', emoji: '💪' },
  { value: 'neutral', emoji: '😐' },
  { value: 'tired', emoji: '😴' },
  { value: 'exhausted', emoji: '💀' },
];

export default function Workout() {
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [workout, setWorkout] = useState({
    title: '', date: format(new Date(), 'yyyy-MM-dd'), duration_minutes: 60,
    type: 'strength', exercises: [], notes: '', mood: 'good', calories_burned: 0,
  });
  const queryClient = useQueryClient();

  const { data: user } = useQuery({ queryKey: ['currentUser'], queryFn: () => base44.auth.me() });

  const { data: workouts, isLoading } = useQuery({
    queryKey: ['workouts'],
    queryFn: () => base44.entities.Workout.list('-date', 100),
    initialData: [],
  });

  const { data: posts } = useQuery({
    queryKey: ['myPosts', user?.email],
    queryFn: () => base44.entities.Post.filter({ created_by: user?.email }),
    enabled: !!user?.email,
    initialData: [],
  });

  const { data: profileArr } = useQuery({
    queryKey: ['myProfile', user?.email],
    queryFn: () => base44.entities.UserProfile.filter({ user_email: user?.email }),
    enabled: !!user?.email,
  });

  const { data: achievements } = useQuery({
    queryKey: ['achievements', user?.email],
    queryFn: () => base44.entities.Achievement.filter({ user_email: user?.email }),
    enabled: !!user?.email,
    initialData: [],
  });

  const addExercise = () => {
    setWorkout(prev => ({
      ...prev,
      exercises: [...prev.exercises, { name: '', sets: [{ reps: 0, weight: 0, is_pr: false }] }]
    }));
  };

  const updateExercise = (index, data) => {
    const exercises = [...workout.exercises];
    exercises[index] = data;
    setWorkout(prev => ({ ...prev, exercises }));
  };

  const removeExercise = (index) => {
    setWorkout(prev => ({ ...prev, exercises: prev.exercises.filter((_, i) => i !== index) }));
  };

  const handleSave = async () => {
    if (!workout.title) { toast.error('Give your workout a name'); return; }
    setSaving(true);
    await base44.entities.Workout.create(workout);
    await queryClient.invalidateQueries({ queryKey: ['workouts'] });
    toast.success('Workout logged! 💪');

    // Check for newly earned badges
    const updatedWorkouts = await base44.entities.Workout.list('-date', 100);
    await checkAndAwardBadges(
      user?.email,
      updatedWorkouts,
      posts || [],
      profileArr?.[0],
      achievements || []
    );
    queryClient.invalidateQueries({ queryKey: ['achievements'] });

    setWorkout({
      title: '', date: format(new Date(), 'yyyy-MM-dd'), duration_minutes: 60,
      type: 'strength', exercises: [], notes: '', mood: 'good', calories_burned: 0,
    });
    setShowForm(false);
    setSaving(false);
  };

  const getTotalVolume = (w) => {
    return w.exercises?.reduce((total, ex) => 
      total + (ex.sets?.reduce((s, set) => s + (set.weight || 0) * (set.reps || 0), 0) || 0), 0) || 0;
  };

  const getPRCount = (w) => {
    return w.exercises?.reduce((count, ex) => 
      count + (ex.sets?.filter(s => s.is_pr).length || 0), 0) || 0;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold">Workout Log</h1>
          <p className="text-sm text-muted-foreground mt-1">Track your training sessions</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-1.5" /> New Workout
        </Button>
      </div>

      {showForm && (
        <Card className="p-5 bg-card border-border space-y-4">
          {/* Template actions */}
          <div className="flex items-center gap-2 justify-end">
            <LoadTemplateSheet
              userEmail={user?.email}
              onLoad={(t) => setWorkout(prev => ({
                ...prev,
                title: prev.title || t.name,
                type: t.type || prev.type,
                exercises: t.exercises || [],
                notes: prev.notes || t.notes || '',
              }))}
            />
            <SaveTemplateDialog
              workout={workout}
              userEmail={user?.email}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input placeholder="Workout name" value={workout.title} onChange={(e) => setWorkout(prev => ({ ...prev, title: e.target.value }))} className="bg-secondary border-0 h-10" />
            <Input type="date" value={workout.date} onChange={(e) => setWorkout(prev => ({ ...prev, date: e.target.value }))} className="bg-secondary border-0 h-10" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Select value={workout.type} onValueChange={(v) => setWorkout(prev => ({ ...prev, type: v }))}>
              <SelectTrigger className="bg-secondary border-0 h-10 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {['strength', 'cardio', 'hiit', 'flexibility', 'crossfit', 'powerlifting', 'bodybuilding'].map(t => (
                  <SelectItem key={t} value={t} className="text-xs capitalize">{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="number" placeholder="Duration (min)" value={workout.duration_minutes || ''} onChange={(e) => setWorkout(prev => ({ ...prev, duration_minutes: Number(e.target.value) }))} className="bg-secondary border-0 h-10 text-xs" />
            <Input type="number" placeholder="Calories" value={workout.calories_burned || ''} onChange={(e) => setWorkout(prev => ({ ...prev, calories_burned: Number(e.target.value) }))} className="bg-secondary border-0 h-10 text-xs" />
            <div className="flex gap-1">
              {moods.map(m => (
                <button key={m.value} onClick={() => setWorkout(prev => ({ ...prev, mood: m.value }))} className={`flex-1 h-10 rounded-lg text-sm transition-all ${workout.mood === m.value ? 'bg-primary/20 scale-110' : 'bg-secondary hover:bg-secondary/80'}`}>
                  {m.emoji}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Exercises</h3>
              <Button variant="outline" size="sm" onClick={addExercise} className="text-xs h-7">
                <Plus className="w-3 h-3 mr-1" /> Exercise
              </Button>
            </div>
            {workout.exercises.map((ex, i) => (
              <ExerciseInput key={i} exercise={ex} exerciseIndex={i} onUpdate={(data) => updateExercise(i, data)} onRemove={() => removeExercise(i)} />
            ))}
            {workout.exercises.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-xs">
                Add exercises to your workout
              </div>
            )}
          </div>

          <Textarea placeholder="Notes (optional)" value={workout.notes} onChange={(e) => setWorkout(prev => ({ ...prev, notes: e.target.value }))} className="bg-secondary border-0 resize-none h-16 text-xs" />

          <Button onClick={handleSave} disabled={saving} className="w-full bg-primary hover:bg-primary/90">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Save Workout
          </Button>
        </Card>
      )}

      {/* History */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : workouts.length === 0 ? (
        <div className="text-center py-16">
          <Dumbbell className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No workouts logged yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {workouts.map(w => (
            <Card key={w.id} className="p-4 bg-card border-border hover:border-primary/20 transition-colors">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-sm">{w.title}</h3>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{w.date}</span>
                    {w.duration_minutes && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{w.duration_minutes}min</span>}
                    {w.calories_burned > 0 && <span className="flex items-center gap-1"><Flame className="w-3 h-3" />{w.calories_burned}cal</span>}
                  </div>
                </div>
                <Badge variant="secondary" className="text-[10px] capitalize">{w.type}</Badge>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-muted-foreground">{w.exercises?.length || 0} exercises</span>
                <span className="text-muted-foreground">{getTotalVolume(w).toLocaleString()} kg volume</span>
                {getPRCount(w) > 0 && (
                  <Badge className="bg-primary/10 text-primary border-0 text-[10px]">
                    <Trophy className="w-2.5 h-2.5 mr-0.5" /> {getPRCount(w)} PR{getPRCount(w) > 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
      <PlateCalculator />
    </div>
  );
}
