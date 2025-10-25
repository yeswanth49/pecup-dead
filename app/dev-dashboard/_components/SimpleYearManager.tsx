'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';

interface YearMappings {
  current_mappings: Record<string, number>;
}

export default function SimpleYearManager() {
  const [mappings, setMappings] = useState<YearMappings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchMappings = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/year-mappings');
      if (!res.ok) {
        const errorText = await res.text();
        setError(`Failed to fetch mappings: ${res.status} ${res.statusText}`);
        return;
      }
      const data = await res.json();
      setMappings(data);
    } catch (err) {
      setError('Network error or failed to parse response');
    } finally {
      setLoading(false);
    }
  };

  const promote = async () => {
    if (!confirm('Promote all students by 1 year?')) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/year-mappings', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        toast({
          title: 'Success',
          description: data.message || 'All students promoted successfully!',
        });
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to promote students.',
          variant: 'destructive',
        });
      }
      await fetchMappings();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Network error or server issue.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const demote = async () => {
    if (!confirm('Demote all students by 1 year?')) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/year-mappings', { method: 'PATCH' });
      const data = await res.json();
      if (res.ok) {
        toast({
          title: 'Success',
          description: data.message || 'All students demoted successfully!',
        });
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to demote students.',
          variant: 'destructive',
        });
      }
      await fetchMappings();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Network error or server issue.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMappings(); }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!mappings) return <div>No mappings available</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Year Mappings (Batch Year → Academic Year)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(mappings.current_mappings || {}).map(([batch, year]: [string, number]) => (
            <div key={batch} className="p-3 border rounded">
              Batch {batch} → Year {year}
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Button onClick={promote} disabled={loading}>Promote All (+1 Year)</Button>
          <Button onClick={demote} disabled={loading} variant="outline">Demote All (-1 Year)</Button>
        </div>
      </CardContent>
    </Card>
  );
}