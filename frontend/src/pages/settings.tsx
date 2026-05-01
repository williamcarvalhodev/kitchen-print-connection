import { useSettings } from "@/hooks/use-print-job";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Save, Printer, Server } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const settingsSchema = z.object({
  printerIp: z.string().min(1, "Printer IP is required"),
  printerPort: z.coerce.number().min(1).max(65535),
  protocol: z.enum(["epos", "raw"]),
  pollInterval: z.coerce.number().min(1).max(60),
  apiKey: z.string().min(1, "API Key is required"),
  storeName: z.string().min(1, "Store Name is required"),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

export default function Settings() {
  const { settings, saveSettings } = useSettings();
  const { toast } = useToast();

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      printerIp: settings.printerIp,
      printerPort: settings.printerPort,
      protocol: settings.protocol,
      pollInterval: settings.pollInterval,
      apiKey: settings.apiKey,
      storeName: settings.storeName,
    },
  });

  function onSubmit(data: SettingsFormValues) {
    saveSettings(data);
    toast({
      title: "Settings Saved",
      description: "Your configuration has been updated successfully.",
    });
  }

  return (
    <div className="flex-1 overflow-auto bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Configuration</h2>
          <p className="text-muted-foreground mt-1 text-sm font-mono uppercase tracking-wider">Hardware & API Connectivity</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            
            <Card className="bg-card border-border">
              <CardHeader className="border-b border-border/50 pb-4">
                <CardTitle className="flex items-center text-lg font-mono tracking-wider uppercase text-foreground">
                  <Printer className="w-5 h-5 mr-3 text-primary" />
                  Local Printer Settings
                </CardTitle>
                <CardDescription className="text-muted-foreground font-mono text-xs">Configure connection to your EPSON thermal printer</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="printerIp"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Printer IP Address</FormLabel>
                      <FormControl>
                        <Input className="font-mono bg-sidebar border-border" placeholder="192.168.0.113" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="printerPort"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Port</FormLabel>
                      <FormControl>
                        <Input type="number" className="font-mono bg-sidebar border-border" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="protocol"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Print Protocol</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="font-mono bg-sidebar border-border">
                            <SelectValue placeholder="Select protocol" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="epos" className="font-mono">ePOS-Print XML</SelectItem>
                          <SelectItem value="raw" className="font-mono">RAW TCP</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription className="font-mono text-xs opacity-70">
                        EPSON TM-T20III requires ePOS-Print XML protocol over HTTP.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader className="border-b border-border/50 pb-4">
                <CardTitle className="flex items-center text-lg font-mono tracking-wider uppercase text-foreground">
                  <Server className="w-5 h-5 mr-3 text-secondary" />
                  Relay API Settings
                </CardTitle>
                <CardDescription className="text-muted-foreground font-mono text-xs">Connection to the cloud relay server</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="apiKey"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel className="font-mono text-xs uppercase tracking-wider text-muted-foreground">API Key</FormLabel>
                      <FormControl>
                        <Input type="password" className="font-mono bg-sidebar border-border" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="storeName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Store Name (Receipt Header)</FormLabel>
                      <FormControl>
                        <Input className="font-mono bg-sidebar border-border" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="pollInterval"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Poll Interval (seconds)</FormLabel>
                      <FormControl>
                        <Input type="number" className="font-mono bg-sidebar border-border" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button type="submit" size="lg" className="font-mono uppercase tracking-wider font-bold">
                <Save className="w-4 h-4 mr-2" />
                Save Configuration
              </Button>
            </div>

          </form>
        </Form>

      </div>
    </div>
  );
}
