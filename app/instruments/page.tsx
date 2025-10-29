import { createClient } from '@/utils/supabase/server';
import { Breadcrumb } from '@/components/Breadcrumb';

export default async function Instruments() {
  const supabase = await createClient();
  const { data: instruments } = await supabase.from("instruments").select();

  return (
    <div className="space-y-4 p-4 md:p-6 lg:p-8">
      <Breadcrumb items={[
        { label: "Home", href: "/" },
        { label: "Instruments", isCurrentPage: true }
      ]} />

      <pre>{JSON.stringify(instruments, null, 2)}</pre>
    </div>
  )
}