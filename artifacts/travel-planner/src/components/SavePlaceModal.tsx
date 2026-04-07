import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateSavedPlace } from "@workspace/api-client-react";

interface GeocodingFeature {
  id: string;
  place_name: string;
  text: string;
  center: [number, number];
}

interface Props {
  feature: GeocodingFeature;
  onClose: () => void;
  onSaved: (place?: { id: number }) => void;
}

const schema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  category: z.string().optional(),
  note: z.string().optional(),
  estimatedDuration: z.coerce.number().int().positive().optional().or(z.literal("")),
  estimatedCost: z.coerce.number().nonnegative().optional().or(z.literal("")),
  priority: z.coerce.number().int().min(1).max(5).optional().or(z.literal("")),
  openingHours: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const CATEGORIES = ["restaurant", "hotel", "attraction", "shopping", "nature", "transport", "other"];

export default function SavePlaceModal({ feature, onClose, onSaved }: Props) {
  const createMutation = useCreateSavedPlace();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: feature.text,
      address: feature.place_name,
      category: "",
      note: "",
      estimatedDuration: "",
      estimatedCost: "",
      priority: "",
      openingHours: "",
    },
  });

  async function onSubmit(data: FormData) {
    const place = await createMutation.mutateAsync({
      data: {
        name: data.name,
        address: data.address,
        latitude: feature.center[1],
        longitude: feature.center[0],
        category: data.category || null,
        note: data.note || null,
        estimatedDuration: data.estimatedDuration !== "" ? Number(data.estimatedDuration) : null,
        estimatedCost: data.estimatedCost !== "" ? Number(data.estimatedCost) : null,
        priority: data.priority !== "" ? Number(data.priority) : null,
        openingHours: data.openingHours || null,
      },
    });
    onSaved(place);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">Save Place</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="p-5 space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl><Input {...field} data-testid="input-place-name" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="address" render={({ field }) => (
              <FormItem>
                <FormLabel>Address</FormLabel>
                <FormControl><Input {...field} data-testid="input-place-address" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="category" render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-place-category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="estimatedDuration" render={({ field }) => (
                <FormItem>
                  <FormLabel>Duration (min)</FormLabel>
                  <FormControl><Input type="number" placeholder="60" {...field} data-testid="input-place-duration" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="estimatedCost" render={({ field }) => (
                <FormItem>
                  <FormLabel>Chi phí dự kiến</FormLabel>
                  <FormControl>
                    <CurrencyInput
                      placeholder="0"
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      name={field.name}
                      data-testid="input-place-cost"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="priority" render={({ field }) => (
                <FormItem>
                  <FormLabel>Priority (1-5)</FormLabel>
                  <FormControl><Input type="number" min={1} max={5} placeholder="3" {...field} data-testid="input-place-priority" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="openingHours" render={({ field }) => (
                <FormItem>
                  <FormLabel>Opening Hours</FormLabel>
                  <FormControl><Input placeholder="9am-6pm" {...field} data-testid="input-place-hours" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="note" render={({ field }) => (
              <FormItem>
                <FormLabel>Note</FormLabel>
                <FormControl><Input placeholder="Any notes about this place..." {...field} data-testid="input-place-note" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
              <Button type="submit" className="flex-1" disabled={createMutation.isPending} data-testid="button-submit-save-place">
                {createMutation.isPending ? "Saving..." : "Save Place"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
