import { MobileLayout } from '@/components/layout/MobileLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bus, MapPin, Loader2 } from 'lucide-react';
import { useParentTransport } from '@/hooks/useTransport';
import { useParentChild } from '@/hooks/useParentData';
import { EmptyState } from '@/components/ui/data-states';

export default function ParentTransport() {
  const { data: child } = useParentChild();
  const { data: transport = [], isLoading } = useParentTransport(child?.id);

  return (
    <MobileLayout title="Transport" showBack>
      <div className="p-4 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : transport.length === 0 ? (
          <EmptyState icon={Bus} title="No transport assigned" description="Your child hasn't been assigned to any bus route yet." />
        ) : (
          transport.map(t => (
            <Card key={t.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Bus className="w-5 h-5 text-primary" />
                  <span className="font-semibold text-sm">{t.route?.route_name}</span>
                  {t.route?.route_number && <Badge variant="outline" className="text-xs">#{t.route.route_number}</Badge>}
                </div>
                <div className="grid grid-cols-1 gap-2 text-sm text-muted-foreground">
                  {t.route?.vehicle_number && <p>🚌 {t.route.vehicle_number}</p>}
                  {t.route?.driver_name && (
                    <p>👤 {t.route.driver_name}{t.route.driver_phone && ` • ${t.route.driver_phone}`}</p>
                  )}
                  {t.pickup_stop && <p><MapPin className="w-3.5 h-3.5 inline mr-1" />Pickup: {t.pickup_stop}</p>}
                  {t.drop_stop && <p><MapPin className="w-3.5 h-3.5 inline mr-1" />Drop: {t.drop_stop}</p>}
                </div>
                <Badge className="capitalize text-xs">{t.boarding_type}</Badge>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </MobileLayout>
  );
}
