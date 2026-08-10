import { useState } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, ZoomIn, X, ImageOff, LayoutGrid, ImageIcon } from 'lucide-react';
import { useStudentProfile } from '@/hooks/useStudentData';
import { useMyTimetable } from '@/hooks/useTimetableEntries';
import { TimetableGrid } from '@/components/timetable/TimetableGrid';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';

export default function StudentTimetable() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: student, isLoading: studentLoading } = useStudentProfile();
  const [showFullscreen, setShowFullscreen] = useState(false);

  const className = student?.class_name || '';
  const section = student?.section || 'A';
  const schoolId = student?.school_id || user?.schoolId || '';

  // Grid data -- own class, section resolved server-side.
  const { data: entries, isLoading: entriesLoading } = useMyTimetable();

  // Image data
  const { data: timetableImage, isLoading: imageLoading } = useQuery({
    queryKey: ['timetable-image', schoolId, className, section],
    queryFn: async () => {
      if (!schoolId || !className) return null;
      const { data } = await api.get('/student/timetable-images', {
        params: { className, section },
      });
      if (!data.image) return null;
      return { id: data.image.id, image_url: data.image.imageUrl, updated_at: data.image.updatedAt };
    },
    enabled: !!schoolId && !!className,
  });

  const handleDownload = async () => {
    if (!timetableImage) return;
    try {
      const response = await fetch((timetableImage as any).image_url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Timetable-${className}-${section}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      window.open((timetableImage as any).image_url, '_blank');
    }
  };

  const loading = studentLoading;
  const hasGrid = entries && entries.length > 0;
  const hasImage = !!timetableImage;

  return (
    <MobileLayout title={t('timetablePage.title')} showBack>
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">{t('timetablePage.myTimetable')}</h2>
            {student && (
              <p className="text-sm text-muted-foreground">
                {className} - {t('timetablePage.section')} {section}
              </p>
            )}
          </div>
          {hasImage && (
            <Button size="sm" variant="outline" onClick={handleDownload}>
              <Download className="w-4 h-4 mr-1.5" />
              {t('common.save')}
            </Button>
          )}
        </div>

        {loading ? (
          <Card><CardContent className="p-4"><Skeleton className="w-full h-64 rounded-lg" /></CardContent></Card>
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
              ) : hasGrid ? (
                <TimetableGrid entries={entries} compact />
              ) : (
                <Card className="p-10 text-center">
                  <LayoutGrid className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-semibold mb-2 text-foreground">No Schedule Data</h3>
                  <p className="text-sm text-muted-foreground">
                    The timetable schedule hasn't been set up yet. Check the Image tab.
                  </p>
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
                      <img
                        src={(timetableImage as any).image_url}
                        alt={`Timetable for ${className} - ${t('timetablePage.section')} ${section}`}
                        className="w-full h-auto cursor-pointer"
                        onClick={() => setShowFullscreen(true)}
                      />
                      <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="icon" variant="secondary" className="shadow-lg h-9 w-9" onClick={() => setShowFullscreen(true)}>
                          <ZoomIn className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="p-3 border-t text-center">
                      <p className="text-xs text-muted-foreground">
                        {t('timetablePage.tapToFullscreen')} • {t('timetablePage.updated')} {new Date((timetableImage as any).updated_at).toLocaleDateString('en-IN')}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="p-10 text-center">
                  <ImageOff className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-semibold mb-2 text-foreground">{t('timetablePage.noTimetable')}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t('timetablePage.timetableNotUploaded', { className: className || 'your class' })}
                  </p>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>

      <Dialog open={showFullscreen} onOpenChange={setShowFullscreen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 overflow-auto">
          <button onClick={() => setShowFullscreen(false)} className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-background/80 flex items-center justify-center shadow-lg">
            <X className="w-4 h-4" />
          </button>
          {timetableImage && <img src={(timetableImage as any).image_url} alt="Timetable" className="w-full h-auto" />}
        </DialogContent>
      </Dialog>
    </MobileLayout>
  );
}
