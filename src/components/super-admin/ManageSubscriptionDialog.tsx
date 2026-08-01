import { useState, useEffect } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { IndianRupee, Users, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCreateSubscription, useUpdateSubscription } from '@/hooks/useSubscription';
import { toast } from 'sonner';
import { format, addYears } from 'date-fns';

interface School {
  id: string;
  name: string;
  code: string;
}

interface ManageSubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** If provided, we're extending/editing an existing subscription */
  existingSubscription?: {
    id: string;
    school_id: string;
    school?: { name?: string; code?: string } | null;
    student_count: number;
    price_per_student: number;
    status: string;
    start_date: string | null;
    end_date: string | null;
  } | null;
  /** Schools that already have subscriptions (to exclude from create) */
  existingSchoolIds?: string[];
}

export function ManageSubscriptionDialog({
  open,
  onOpenChange,
  existingSubscription,
  existingSchoolIds = [],
}: ManageSubscriptionDialogProps) {
  const isMobile = useIsMobile();
  const createSubscription = useCreateSubscription();
  const updateSubscription = useUpdateSubscription();
  const isEditing = !!existingSubscription;

  const [schools, setSchools] = useState<School[]>([]);
  const [loadingSchools, setLoadingSchools] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    schoolId: '',
    studentCount: '',
    pricePerStudent: '',
    status: 'active' as string,
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(addYears(new Date(), 1), 'yyyy-MM-dd'),
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      if (existingSubscription) {
        setFormData({
          schoolId: existingSubscription.school_id,
          studentCount: String(existingSubscription.student_count),
          pricePerStudent: String(existingSubscription.price_per_student || ''),
          status: existingSubscription.status,
          startDate: existingSubscription.start_date || format(new Date(), 'yyyy-MM-dd'),
          endDate: existingSubscription.end_date || format(addYears(new Date(), 1), 'yyyy-MM-dd'),
        });
      } else {
        setFormData({
          schoolId: '',
          studentCount: '',
          pricePerStudent: '',
          status: 'active',
          startDate: format(new Date(), 'yyyy-MM-dd'),
          endDate: format(addYears(new Date(), 1), 'yyyy-MM-dd'),
        });
      }
    }
  }, [open, existingSubscription]);

  // Fetch schools for the selector (only for new subscriptions)
  useEffect(() => {
    if (open && !isEditing) {
      setLoadingSchools(true);
      supabase
        .from('schools')
        .select('id, name, code')
        .eq('is_active', true)
        .order('name')
        .then(({ data, error }) => {
          if (!error && data) {
            const available = data.filter(s => !existingSchoolIds.includes(s.id));
            setSchools(available);
          }
          setLoadingSchools(false);
        });
    }
  }, [open, isEditing, existingSchoolIds]);

  // Auto-fetch student count when school is selected
  useEffect(() => {
    if (!formData.schoolId || isEditing) return;
    supabase
      .from('students')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', formData.schoolId)
      .eq('status', 'active')
      .then(({ count }) => {
        if (count !== null) {
          setFormData(prev => ({ ...prev, studentCount: String(count) }));
        }
      });
  }, [formData.schoolId, isEditing]);

  const studentCount = parseInt(formData.studentCount) || 0;
  const isTrial = formData.status === 'trial';
  const pricePerStudent = isTrial ? 0 : (parseInt(formData.pricePerStudent) || 0);
  const totalAmount = studentCount * pricePerStudent;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditing && !formData.schoolId) {
      toast.error('Please select a school');
      return;
    }
    if (studentCount <= 0) {
      toast.error('Student count must be greater than 0');
      return;
    }

    setSubmitting(true);
    try {
      if (isEditing && existingSubscription) {
        await updateSubscription.mutateAsync({
          id: existingSubscription.id,
          student_count: studentCount,
          price_per_student: pricePerStudent,
          status: formData.status as any,
          start_date: formData.startDate,
          end_date: formData.endDate,
        });
      } else {
        await createSubscription.mutateAsync({
          schoolId: formData.schoolId,
          studentCount,
          pricePerStudent,
          status: formData.status,
          startDate: formData.startDate,
          endDate: formData.endDate,
        });
      }
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save subscription');
    } finally {
      setSubmitting(false);
    }
  };

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* School Selector (only for new) */}
      {!isEditing ? (
        <div className="grid gap-2">
          <Label>School *</Label>
          <Select
            value={formData.schoolId}
            onValueChange={(value) => setFormData({ ...formData, schoolId: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder={loadingSchools ? 'Loading schools...' : 'Select a school'} />
            </SelectTrigger>
            <SelectContent>
              {schools.map(school => (
                <SelectItem key={school.id} value={school.id}>
                  {school.name} ({school.code})
                </SelectItem>
              ))}
              {schools.length === 0 && !loadingSchools && (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  All schools already have subscriptions
                </div>
              )}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <div className="p-3 rounded-xl bg-muted/50 border">
          <p className="text-xs text-muted-foreground">School</p>
          <p className="font-semibold text-sm">
            {existingSubscription?.school?.name} ({existingSubscription?.school?.code})
          </p>
        </div>
      )}

      {/* Student Count */}
      <div className="grid gap-2">
        <Label htmlFor="studentCount">
          <span className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            Number of Students *
          </span>
        </Label>
        <Input
          id="studentCount"
          type="number"
          min="1"
          value={formData.studentCount}
          onChange={(e) => setFormData({ ...formData, studentCount: e.target.value })}
          placeholder="Enter student count"
          required
        />
      </div>

      {/* Price Per Student (hidden for trial) */}
      {formData.status !== 'trial' && (
        <div className="grid gap-2">
          <Label htmlFor="pricePerStudent">
            <span className="flex items-center gap-1.5">
              <IndianRupee className="w-3.5 h-3.5" />
              Price Per Student (₹) *
            </span>
          </Label>
          <Input
            id="pricePerStudent"
            type="number"
            min="1"
            value={formData.pricePerStudent}
            onChange={(e) => setFormData({ ...formData, pricePerStudent: e.target.value })}
            placeholder="Enter price per student"
            required
          />
        </div>
      )}

      {/* Status */}
      <div className="grid gap-2">
        <Label>Status</Label>
        <Select
          value={formData.status}
          onValueChange={(value) => setFormData({ ...formData, status: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="trial">Trial</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Dates */}
      <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-2'}`}>
        <div className="grid gap-2">
          <Label htmlFor="startDate">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              Start Date
            </span>
          </Label>
          <Input
            id="startDate"
            type="date"
            value={formData.startDate}
            onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="endDate">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              End Date
            </span>
          </Label>
          <Input
            id="endDate"
            type="date"
            value={formData.endDate}
            onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
          />
        </div>
      </div>

      {/* Amount Preview (hidden for trial) */}
      {studentCount > 0 && formData.status !== 'trial' && pricePerStudent > 0 && (
        <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total Amount</span>
            <span className="flex items-center gap-0.5 text-lg font-bold text-primary">
              <IndianRupee className="w-4 h-4" />
              {totalAmount.toLocaleString()}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {studentCount} students × ₹{pricePerStudent}/student/year
          </p>
        </div>
      )}

      {/* Actions */}
      <div className={`flex gap-3 pt-2 ${isMobile ? '' : 'justify-end'}`}>
        <Button
          type="button"
          variant="outline"
          className={isMobile ? 'flex-1' : ''}
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className={isMobile ? 'flex-1' : ''}
          disabled={submitting}
        >
          {submitting
            ? 'Saving...'
            : isEditing
              ? 'Update Subscription'
              : 'Create Subscription'}
        </Button>
      </div>
    </form>
  );

  const title = isEditing ? 'Edit Subscription' : 'Create Subscription';
  const description = isEditing
    ? 'Update subscription details for this school'
    : 'Manually create a new subscription for a school';

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="px-4 pb-6 max-h-[90dvh]">
          <DrawerHeader className="px-0">
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerDescription>{description}</DrawerDescription>
          </DrawerHeader>
          <div data-vaul-no-drag className="overflow-y-auto">{formContent}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {formContent}
      </DialogContent>
    </Dialog>
  );
}
