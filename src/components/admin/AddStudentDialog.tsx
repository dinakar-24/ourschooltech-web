import { useState } from 'react';
import { DOBPicker } from '@/components/ui/dob-picker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger,
} from '@/components/ui/drawer';
import { Plus, Loader2, User, Hash, Mail, Droplets, IndianRupee, MapPin } from 'lucide-react';
import { IndianPhoneInput } from '@/components/ui/indian-phone-input';
import { AvatarUpload } from '@/components/ui/avatar-upload';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

export interface FeeEntry {
  fee_type: string;
  amount: string;
  due_date: string;
}

interface AddStudentDialogProps {
  classes: { id: string; name: string }[] | undefined;
  formData: {
    full_name: string;
    admission_number: string;
    class_name: string;
    section: string;
    roll_number: string;
    gender: string;
    date_of_birth: string;
    parent_name: string;
    parent_phone: string;
    alternate_phone: string;
    student_email: string;
    parent_email: string;
    blood_group: string;
    address: string;
    avatar_url: string;
  };
  feeEntries: FeeEntry[];
  onFeeEntriesChange: (entries: FeeEntry[]) => void;
  onInputChange: (field: string, value: string) => void;
  onSubmit: () => void;
  isPending: boolean;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const DEFAULT_SECTIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const GENDERS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const FEE_TYPES = [
  { value: 'Tuition Fee', label: 'Tuition Fee', desc: 'Monthly academic & classroom charges' },
  { value: 'Transport Fee', label: 'Transport Fee', desc: 'School bus / van service charges' },
  { value: 'Lab Fee', label: 'Lab Fee', desc: 'Science & computer lab usage' },
  { value: 'Library Fee', label: 'Library Fee', desc: 'Library membership & book access' },
  { value: 'Sports Fee', label: 'Sports Fee', desc: 'Sports equipment & activities' },
  { value: 'Exam Fee', label: 'Exam Fee', desc: 'Examination & assessment charges' },
];


function MultiChipSelector({ 
  options, values, onChange, label, placeholder, required
}: { 
  options: { value: string; label: string; desc?: string }[]; 
  values: string[]; 
  onChange: (v: string[]) => void; 
  label: string; 
  placeholder?: string;
  required?: boolean;
}) {
  const [customValue, setCustomValue] = useState('');

  const toggleOption = (val: string) => {
    onChange(values.includes(val) ? values.filter(v => v !== val) : [...values, val]);
  };

  const addCustom = () => {
    const trimmed = customValue.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
    }
    setCustomValue('');
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {options.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggleOption(opt.value)}
            className={cn(
              "flex flex-col items-start px-3 py-2 rounded-lg text-left border transition-colors",
              values.includes(opt.value)
                ? "bg-primary/10 text-primary border-primary ring-1 ring-primary/30"
                : "bg-muted/50 text-foreground border-border hover:bg-muted"
            )}
          >
            <span className="text-sm font-medium">{opt.label}</span>
            {opt.desc && <span className="text-[11px] text-muted-foreground leading-tight">{opt.desc}</span>}
          </button>
        ))}
      </div>
      {/* Show custom values as removable chips */}
      {values.filter(v => !options.some(o => o.value === v)).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {values.filter(v => !options.some(o => o.value === v)).map(v => (
            <span key={v} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-primary/10 text-primary border border-primary/20">
              {v}
              <button type="button" onClick={() => onChange(values.filter(x => x !== v))} className="hover:text-destructive">×</button>
            </span>
          ))}
        </div>
      )}
      {placeholder && (
        <Input
          value={customValue}
          onChange={(e) => setCustomValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
          onBlur={addCustom}
          placeholder={placeholder}
          className="h-10 mt-1"
        />
      )}
    </div>
  );
}

function ChipSelectorWithInput({ 
  options, value, onChange, label, required, placeholder 
}: { 
  options: { value: string; label: string }[]; 
  value: string; 
  onChange: (v: string) => void; 
  label: string; 
  required?: boolean;
  placeholder?: string;
}) {
  const isCustom = value !== '' && !options.some(o => o.value === value);

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors",
              value === opt.value
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {placeholder && (
        <Input
          value={isCustom ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-10 mt-1"
        />
      )}
    </div>
  );
}

function ChipSelector({ 
  options, value, onChange, label, required 
}: { 
  options: { value: string; label: string }[]; 
  value: string; 
  onChange: (v: string) => void; 
  label: string; 
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(value === opt.value ? '' : opt.value)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors",
              value === opt.value
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function StudentFormContent({ formData, feeEntries, onFeeEntriesChange, onInputChange, onSubmit, isPending, classes, onClose }: {
  formData: AddStudentDialogProps['formData'];
  feeEntries: FeeEntry[];
  onFeeEntriesChange: (entries: FeeEntry[]) => void;
  onInputChange: (field: string, value: string) => void;
  onSubmit: () => void;
  isPending: boolean;
  classes: AddStudentDialogProps['classes'];
  onClose: () => void;
}) {
  const classOptions = (classes || []).map(c => ({ value: c.name, label: c.name }));
  const sectionOptions = DEFAULT_SECTIONS.map(s => ({ value: s, label: s }));
  const bloodGroupOptions = BLOOD_GROUPS.map(b => ({ value: b, label: b }));

  const safeFeeEntries = feeEntries || [];
  const selectedFeeTypes = safeFeeEntries.map(e => e.fee_type);

  const handleFeeTypesChange = (types: string[]) => {
    const newEntries = types.map(t => {
      const existing = safeFeeEntries.find(e => e.fee_type === t);
      return existing || { fee_type: t, amount: '', due_date: '' };
    });
    onFeeEntriesChange(newEntries);
  };

  const updateFeeEntry = (index: number, field: 'amount' | 'due_date', value: string) => {
    const updated = [...safeFeeEntries];
    updated[index] = { ...updated[index], [field]: value };
    onFeeEntriesChange(updated);
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="space-y-4 px-4 sm:px-6 pb-6">
      {/* Avatar */}
      <div className="flex justify-center">
        <AvatarUpload value={formData.avatar_url || null} onChange={(url) => onInputChange('avatar_url', url || '')} fallback={formData.full_name} folder="students" />
      </div>

      {/* Full Name & Admission Number */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Full Name <span className="text-destructive">*</span></Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={formData.full_name} onChange={(e) => onInputChange('full_name', e.target.value)} placeholder="Enter student name" className="pl-10 h-11" required />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Admission Number <span className="text-destructive">*</span></Label>
          <div className="relative">
            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={formData.admission_number} onChange={(e) => onInputChange('admission_number', e.target.value)} placeholder="ADM2024XXX" className="pl-10 h-11" required />
          </div>
        </div>
      </div>

      {/* Class - Chips + manual entry */}
      <ChipSelectorWithInput
        label="Class"
        required
        options={classOptions}
        value={formData.class_name}
        onChange={(v) => onInputChange('class_name', v)}
        placeholder="Or type class name manually"
      />

      {/* Section - Chips + manual entry */}
      <ChipSelectorWithInput
        label="Section"
        required
        options={sectionOptions}
        value={formData.section}
        onChange={(v) => onInputChange('section', v)}
        placeholder="Or type section manually"
      />

      {/* Roll Number & Gender */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Roll Number <span className="text-destructive">*</span></Label>
          <Input type="number" min="0" value={formData.roll_number} onChange={(e) => onInputChange('roll_number', e.target.value)} placeholder="Enter roll number" className="h-11 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" required />
        </div>
        <ChipSelector label="Gender" required options={GENDERS} value={formData.gender} onChange={(v) => onInputChange('gender', v)} />
      </div>

      {/* Blood Group */}
      <ChipSelector label="Blood Group" options={bloodGroupOptions} value={formData.blood_group} onChange={(v) => onInputChange('blood_group', v)} />

      {/* Parent Name & Phone */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Parent Name</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={formData.parent_name} onChange={(e) => onInputChange('parent_name', e.target.value)} placeholder="Enter parent name" className="pl-10 h-11" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Phone Number</Label>
          <IndianPhoneInput value={formData.parent_phone} onChange={(v) => onInputChange('parent_phone', v)} />
        </div>
      </div>

      {/* Alternate Phone */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Alternate Phone (Emergency)</Label>
        <IndianPhoneInput value={formData.alternate_phone} onChange={(v) => onInputChange('alternate_phone', v)} placeholder="Emergency contact" />
      </div>

      {/* Student Email & Parent Email - Separate Gmail accounts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Student Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input type="email" value={formData.student_email} onChange={(e) => onInputChange('student_email', e.target.value)} placeholder="Student's Gmail (for student login)" className="pl-10 h-11" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Parent Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input type="email" value={formData.parent_email} onChange={(e) => onInputChange('parent_email', e.target.value)} placeholder="Parent's Gmail (for parent login)" className="pl-10 h-11" />
          </div>
        </div>
      </div>

      {/* DOB */}
      <DOBPicker
        value={formData.date_of_birth}
        onChange={(v) => onInputChange('date_of_birth', v)}
        required
      />

      {/* Address */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Address</Label>
        <div className="relative">
          <MapPin className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
          <Input value={formData.address} onChange={(e) => onInputChange('address', e.target.value)} placeholder="Enter home address" className="pl-10 h-11" />
        </div>
      </div>


      {/* Actions */}
      <div className="flex gap-3 pt-2 border-t">
        <Button type="button" variant="outline" onClick={onClose} className="flex-1 sm:flex-none">Cancel</Button>
        <Button type="submit" disabled={isPending} className="flex-1 sm:flex-none sm:ml-auto">
          {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {isPending ? 'Adding…' : 'Add Student'}
        </Button>
      </div>
    </form>
  );
}

export function AddStudentDialog({ classes, formData, feeEntries, onFeeEntriesChange, onInputChange, onSubmit, isPending, isOpen, onOpenChange }: AddStudentDialogProps) {
  const isMobile = useIsMobile();

  const triggerButton = (
    <Button size="sm">
      <Plus className="w-4 h-4 mr-2" />
      Add Student
    </Button>
  );

  const headerContent = (
    <div className="flex items-center gap-3 px-4 sm:px-6 pt-4 sm:pt-6 pb-2">
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
        <Plus className="w-5 h-5 text-primary" />
      </div>
      <div>
        <p className="text-lg font-semibold">Add New Student</p>
        <p className="text-sm text-muted-foreground">Fill in the student details</p>
      </div>
    </div>
  );

  const formProps = { formData, feeEntries, onFeeEntriesChange, onInputChange, onSubmit, isPending, classes };

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={onOpenChange}>
        <DrawerTrigger asChild>{triggerButton}</DrawerTrigger>
        <DrawerContent className="max-h-[85dvh] h-[85dvh] bg-background flex flex-col">
          <DrawerHeader className="sr-only">
            <DrawerTitle>Add New Student</DrawerTitle>
            <DrawerDescription>Fill in the student details</DrawerDescription>
          </DrawerHeader>
          <div className="shrink-0">{headerContent}</div>
          <div data-vaul-no-drag className="overflow-y-auto flex-1 min-h-0 bg-background overscroll-contain pb-safe">
            <StudentFormContent {...formProps} onClose={() => onOpenChange(false)} />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{triggerButton}</DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90dvh] overflow-y-auto p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Add New Student</DialogTitle>
          <DialogDescription>Fill in the student details</DialogDescription>
        </DialogHeader>
        {headerContent}
        <StudentFormContent {...formProps} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
