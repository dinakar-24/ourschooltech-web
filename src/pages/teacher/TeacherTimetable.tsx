import { useState, useEffect } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Clock, Download, ZoomIn, X, ImageOff, LayoutGrid, ImageIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useEffectiveSchoolId } from '@/hooks/useEffectiveSchoolId';
import { useClasses } from '@/hooks/useClasses';
import { useTimetableEntries } from '@/hooks/useTimetableEntries';
import { TimetableGrid } from '@/components/timetable/TimetableGrid';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export default function TeacherTimetable() {
  const { user } = useAuth();
  const schoolId = useEffectiveSchoolId();
  const { data: classes } = useClasses();
  const [showFullscreen, setShowFullscreen] = useState(false);

  const classNames = classes?.map(c => c.name) || [];
  const [selectedClass, setSelectedClass] = useState(classNames[0] || '');
  const [selectedSectionId, setSelectedSectionId] = useState('');

  // Real Section rows only -- the grid needs a real sectionId FK, and reads
  // are scoped server-side to sections this teacher teaches in or is the
  // class teacher for (any other section 403s, handled below).
  const selectedClassData = classes?.find(c => c.name === selectedClass);
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

  // Grid data
  const { data: entries, isLoading: entriesLoading, error: entriesError } = useTimetableEntries(selectedSectionId || undefined);
  const isForbidden = (entriesError as any)?.response?.status === 403;

  // Image data
  const { data: timetableImage, isLoading: imageLoading } = useQuery({
    queryKey: ['timetable-image', schoolId, selectedClass, selectedSection],
    queryFn: async () => {
      if (!schoolId || !selectedClass) return null;
      const { data } = await api.get('/school/timetable-images', {
        params: { className: selectedClass, section: selectedSection },
      });
      if (!data.image) return null;
      return { id: data.image.id, image_url: data.image.imageUrl, updated_at: data.image.updatedAt };
    },
    enabled: !!schoolId && !!selectedClass,
  });

  const handleDownload = async () => {
    if (!timetableImage) return;
    try {
      const response = await fetch((timetableImage as any).image_url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Timetable-${selectedClass}-${selectedSection}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      window.open((timetableImage as any).image_url, '_blank');
    }
  };

  const hasGrid = entries && entries.length > 0;
  const hasImage = !!timetableImage;

  return (
    <MobileLayout title="Timetable" showBack>
      <div className="p-4 space-y-4">
        {/* Class selector */}
        <div className="flex gap-2">
          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Select Class" />
            </SelectTrigger>
            <SelectContent>
              {classNames.map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedSectionId} onValueChange={setSelectedSectionId} disabled={sections.length === 0}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Section" />
            </SelectTrigger>
            <SelectContent>
              {sections.map(s => (
                <SelectItem key={s.id} value={s.id}>Section {s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Quick class chips */}
        {classNames.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {classNames.slice(0, 8).map(cls => (
              <Badge key={cls} variant={cls === selectedClass ? 'default' : 'outline'} className="cursor-pointer" onClick={() => setSelectedClass(cls)}>
                {cls}
              </Badge>
            ))}
          </div>
        )}

        {!selectedClass ? (
          <Card className="p-10 text-center">
            <Clock className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2 text-foreground">Select a Class</h3>
            <p className="text-sm text-muted-foreground">Choose a class above to view its timetable.</p>
          </Card>
        ) : (
          <Tabs defaultValue={hasGrid ? 'schedule' : 'image'}>
            <TabsList className="w-full">
              <TabsTrigger value="schedule" className="flex-1 gap-1.5">
                <LayoutGrid className="w-4 h-4" />
                Schedule
              </TabsTrigger>
              <TabsTrigger value="image" className="flex-1 gap-1.5">
                <ImageIcon className="w-4 h-4" />
                Image
              </TabsTrigger>
            </TabsList>

            <TabsContent value="schedule" className="mt-3">
              {entriesLoading ? (
                <Card><CardContent className="p-4"><Skeleton className="w-full h-64 rounded-lg" /></CardContent></Card>
              ) : isForbidden ? (
                <Card className="p-10 text-center">
                  <LayoutGrid className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-semibold mb-2 text-foreground">Not Authorized</h3>
                  <p className="text-sm text-muted-foreground">
                    You're not the class teacher for {selectedClass} - Section {selectedSection} and don't teach any periods there.
                  </p>
                </Card>
              ) : hasGrid ? (
                <TimetableGrid entries={entries} compact />
              ) : (
                <Card className="p-10 text-center">
                  <LayoutGrid className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-semibold mb-2 text-foreground">No Schedule Data</h3>
                  <p className="text-sm text-muted-foreground">No timetable data available. Check the Image tab.</p>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="image" className="mt-3">
              {imageLoading ? (
                <Card><CardContent className="p-4"><Skeleton className="w-full h-64 rounded-lg" /></CardContent></Card>
              ) : hasImage ? (
                <Card className="overflow-hidden">
                  <CardContent className="p-0">
                    <div className="relative group">
                      <img src={(timetableImage as any).image_url} alt={`Timetable for ${selectedClass} - Section ${selectedSection}`} className="w-full h-auto cursor-pointer" onClick={() => setShowFullscreen(true)} />
                      <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="icon" variant="secondary" className="shadow-lg h-9 w-9" onClick={() => setShowFullscreen(true)}><ZoomIn className="w-4 h-4" /></Button>
                      </div>
                    </div>
                    <div className="p-3 border-t flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">Updated {new Date((timetableImage as any).updated_at).toLocaleDateString('en-IN')}</p>
                      <Button size="sm" variant="outline" onClick={handleDownload}><Download className="w-4 h-4 mr-1.5" />Download</Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="p-10 text-center">
                  <ImageOff className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-semibold mb-2 text-foreground">No Timetable Available</h3>
                  <p className="text-sm text-muted-foreground">The timetable for {selectedClass} - Section {selectedSection} hasn't been uploaded yet.</p>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>

      <Dialog open={showFullscreen} onOpenChange={setShowFullscreen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 overflow-auto">
          <button onClick={() => setShowFullscreen(false)} className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-background/80 flex items-center justify-center shadow-lg"><X className="w-4 h-4" /></button>
          {timetableImage && <img src={(timetableImage as any).image_url} alt="Timetable" className="w-full h-auto" />}
        </DialogContent>
      </Dialog>
    </MobileLayout>
  );
}
