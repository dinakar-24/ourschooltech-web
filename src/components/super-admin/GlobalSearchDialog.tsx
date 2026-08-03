import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Building2, User, X, Loader2 } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { useDebounce } from '@/hooks/useDebounce';
import { useIsMobile } from '@/hooks/use-mobile';

interface SearchResult {
  id: string;
  type: 'school' | 'user';
  title: string;
  subtitle: string;
  icon: 'school' | 'user';
  route: string;
}

interface GlobalSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalSearchDialog({ open, onOpenChange }: GlobalSearchDialogProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debouncedQuery = useDebounce(query, 300);

  const search = useCallback(async (q: string) => {
    if (!q.trim() || q.trim().length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const [schoolsRes, usersRes] = await Promise.all([
        api.get<{ schools: { id: string; name: string; schoolCode: string; city: string | null }[] }>('/superadmin/schools', { params: { search: q, limit: 5 } }),
        api.get<{ users: { id: string; fullName: string; email: string }[] }>('/superadmin/users', { params: { search: q, limit: 5 } }),
      ]);

      const mapped: SearchResult[] = [];

      schoolsRes.data.schools.forEach((s) =>
        mapped.push({
          id: s.id,
          type: 'school',
          title: s.name,
          subtitle: `${s.schoolCode} · ${s.city ?? ''}`,
          icon: 'school',
          route: '/super-admin/schools',
        })
      );

      usersRes.data.users.forEach((u) =>
        mapped.push({
          id: u.id,
          type: 'user',
          title: u.fullName,
          subtitle: u.email,
          icon: 'user',
          route: '/super-admin/users',
        })
      );

      setResults(mapped);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    search(debouncedQuery);
  }, [debouncedQuery, search]);

  const handleSelect = (result: SearchResult) => {
    onOpenChange(false);
    setQuery('');
    navigate(result.route);
  };

  const handleClose = () => {
    onOpenChange(false);
    setQuery('');
    setResults([]);
  };

  const searchContent = (
    <>
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <Search className="w-4 h-4 text-muted-foreground shrink-0" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search schools, users..."
          className="border-0 shadow-none focus-visible:ring-0 px-0 h-auto"
          autoFocus
        />
        {query && (
          <button onClick={() => setQuery('')} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto max-h-[60vh] sm:max-h-80">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : results.length > 0 ? (
          <div className="py-2">
            {results.map((result) => (
              <button
                key={`${result.type}-${result.id}`}
                onClick={() => handleSelect(result)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  {result.icon === 'school' ? (
                    <Building2 className="w-4 h-4 text-primary" />
                  ) : (
                    <User className="w-4 h-4 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{result.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
                </div>
                <span className="text-[10px] uppercase font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                  {result.type}
                </span>
              </button>
            ))}
          </div>
        ) : query.length >= 2 && !loading ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No results found for "{query}"
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Type at least 2 characters to search
          </div>
        )}
      </div>
    </>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={handleClose}>
        <DrawerContent>
          {searchContent}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
        {searchContent}
      </DialogContent>
    </Dialog>
  );
}
