import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Clock, Eye, Pencil, ImageIcon, LayoutGrid } from 'lucide-react';
import { useClasses } from '@/hooks/useClasses';
import { useEffectiveSchoolId } from '@/hooks/useEffectiveSchoolId';
import { useTimetableEntries } from '@/hooks/useTimetableEntries';
import { TimetableGrid } from '@/components/timetable/TimetableGrid';
import { TimetableEditor } from '@/components/timetable/TimetableEditor';
import { TimetableImageUpload } from '@/components/timetable/TimetableImageUpload';
import { Skeleton } from '@/components/ui/skeleton';

export default function TimetablePage() {
  const { data: classes } = useClasses();
  const schoolId = useEffectiveSchoolId();

  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [maxPeriod, setMaxPeriod] = useState(8);

  const classNames = classes?.map(c => c.name) || [];
  const selectedClassData = classes?.find(c => c.name === selectedClass);
  // Real Section rows only -- the grid needs a real sectionId FK, unlike the
  // free-text-name fallback useSections() offers for other pages.
  const sections = selectedClassData?.sections || [];
  const selectedSectionData = sections.find(s => s.id === selectedSectionId);
  const selectedSection = selectedSectionData?.name || '';

  useEffect(() => {
    if (sections.length > 0 && !sections.some(s => s.id === selectedSectionId)) {
      setSelectedSectionId(sections[0].id);
    } else if (sections.length === 0 && selectedSectionId) {
      setSelectedSectionId('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClass, sections]);

  const { data: entries, isLoading: entriesLoading } = useTimetableEntries(selectedSectionId || undefined);

  // Sync maxPeriod with data
  useEffect(() => {
    if (entries && entries.length > 0) {
      const max = Math.max(...entries.map(e => e.period_number));
      if (max > maxPeriod) setMaxPeriod(max);
    }
  }, [entries]);

  return (
      <div className="space-y-5 animate-fade-up pb-6">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select Class" />
            </SelectTrigger>
            <SelectContent>
              {classNames.map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedSectionId} onValueChange={setSelectedSectionId} disabled={sections.length === 0}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Section" />
            </SelectTrigger>
            <SelectContent>
              {sections.map(s => (
                <SelectItem key={s.id} value={s.id}>Section {s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!selectedClass ? (
          <Card className="p-12 text-center">
            <Clock className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">Select a Class</h3>
            <p className="text-muted-foreground text-sm">
              Choose a class and section above to view or manage the timetable.
            </p>
          </Card>
        ) : sections.length === 0 ? (
          <Card className="p-12 text-center">
            <Clock className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No Sections Found</h3>
            <p className="text-muted-foreground text-sm">
              {selectedClass} has no sections yet. Add one from the Classes page first.
            </p>
          </Card>
        ) : (
          <Tabs defaultValue="grid" className="space-y-4">
            <TabsList>
              <TabsTrigger value="grid" className="gap-1.5">
                <LayoutGrid className="w-4 h-4" />
                Timetable Grid
              </TabsTrigger>
              <TabsTrigger value="image" className="gap-1.5">
                <ImageIcon className="w-4 h-4" />
                Upload Image
              </TabsTrigger>
            </TabsList>

            <TabsContent value="grid" className="space-y-4">
              {/* View/Edit toggle */}
              <div className="flex justify-end">
                <Button
                  variant={editMode ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setEditMode(!editMode)}
                  className="gap-1.5"
                >
                  {editMode ? <Eye className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
                  {editMode ? 'View Mode' : 'Edit Mode'}
                </Button>
              </div>

              {entriesLoading ? (
                <Card className="p-8"><Skeleton className="w-full h-64" /></Card>
              ) : editMode ? (
                <TimetableEditor
                  entries={entries || []}
                  classId={selectedClassData!.id}
                  sectionId={selectedSectionId}
                  maxPeriod={maxPeriod}
                  onMaxPeriodChange={setMaxPeriod}
                />
              ) : entries && entries.length > 0 ? (
                <TimetableGrid entries={entries} maxPeriod={maxPeriod} />
              ) : (
                <Card className="p-12 text-center">
                  <LayoutGrid className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-50" />
                  <h3 className="text-lg font-semibold mb-2">No Timetable Data</h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    No periods have been added for {selectedClass} - Section {selectedSection} yet.
                  </p>
                  <Button size="sm" onClick={() => setEditMode(true)}>
                    <Pencil className="w-4 h-4 mr-1.5" />
                    Start Building Timetable
                  </Button>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="image">
              <TimetableImageUpload
                schoolId={schoolId}
                selectedClass={selectedClass}
                selectedSection={selectedSection}
              />
            </TabsContent>
          </Tabs>
        )}
      </div>
  );
}
