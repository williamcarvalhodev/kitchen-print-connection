import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Save, FileText, ChefHat, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API_URL = "/api/layout";

const DEFAULT_LAYOUT = {
  storeName: "Wagasa Sushi Bar",
  storeAddress: "Av. Dom Nuno Alvares Pereira 67, Setubal",
  storePhone: "+351 938 122 182",
  storeNif: "516235586",
  storeInstagram: "@wagasasushi",
  footerMessage: "Obrigado pela sua encomenda!",
  printCopies: 1,
  showCupom1: true,
  showCupom2: true,
  cupom1Fields: {
    showHeader: true,
    showOrderNumber: true,
    showDate: true,
    showPaymentMethod: true,
    showDeliveryMethod: true,
    showDeliveryAddress: true,
    showCustomerName: true,
    showCustomerPhone: true,
    showItems: true,
    showNotes: true,
    showTotal: true,
    showFooter: true,
  },
  cupom2Fields: {
    showOrderNumber: true,
    showDate: true,
    showCustomerName: true,
    showItems: true,
    showNotes: true,
    showCheckbox: false,
  },
};

export default function Layout() {
  const [layout, setLayout] = useState(DEFAULT_LAYOUT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetch(API_URL)
      .then(r => r.json())
      .then(data => { setLayout({ ...DEFAULT_LAYOUT, ...data }); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await fetch(API_URL, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(layout),
      });
      toast({ title: "Layout Saved", description: "Receipt layout updated successfully." });
    } catch {
      toast({ title: "Error", description: "Failed to save layout.", variant: "destructive" });
    }
    setSaving(false);
  }

  function setField(field: string, value: string | number) {
    setLayout(prev => ({ ...prev, [field]: value }));
  }

  function setCupom1(field: string, value: boolean) {
    setLayout(prev => ({ ...prev, cupom1Fields: { ...prev.cupom1Fields, [field]: value } }));
  }

  function setCupom2(field: string, value: boolean) {
    setLayout(prev => ({ ...prev, cupom2Fields: { ...prev.cupom2Fields, [field]: value } }));
  }

  if (loading) return (
    <div className="flex-1 flex items-center justify-center text-muted-foreground font-mono">
      LOADING LAYOUT...
    </div>
  );

  return (
    <div className="flex-1 overflow-auto bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Receipt Layout</h2>
          <p className="text-muted-foreground mt-1 text-sm font-mono uppercase tracking-wider">Configure what prints on each receipt</p>
        </div>

        {/* Store Info */}
        <Card className="bg-card border-border">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="flex items-center text-lg font-mono tracking-wider uppercase text-foreground">
              <FileText className="w-5 h-5 mr-3 text-primary" />
              Store Information
            </CardTitle>
            <CardDescription className="font-mono text-xs text-muted-foreground">Appears on the receipt header and footer</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { label: "Store Name", field: "storeName" },
              { label: "NIF", field: "storeNif" },
              { label: "Phone", field: "storePhone" },
              { label: "Instagram", field: "storeInstagram" },
              { label: "Address", field: "storeAddress" },
              { label: "Footer Message", field: "footerMessage" },
            ].map(({ label, field }) => (
              <div key={field} className={field === "storeAddress" || field === "footerMessage" ? "col-span-2" : ""}>
                <Label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
                <Input
                  className="font-mono bg-sidebar border-border mt-1"
                  value={(layout as any)[field] || ""}
                  onChange={e => setField(field, e.target.value)}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Print Copies */}
        <Card className="bg-card border-border">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="flex items-center text-lg font-mono tracking-wider uppercase text-foreground">
              <Copy className="w-5 h-5 mr-3 text-secondary" />
              Print Copies
            </CardTitle>
            <CardDescription className="font-mono text-xs text-muted-foreground">Number of times each order is printed</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex items-center gap-6">
              {[1, 2, 3].map(n => (
                <button
                  key={n}
                  onClick={() => setField("printCopies", n)}
                  className={`px-6 py-3 rounded-lg font-mono font-bold text-lg border-2 transition-all ${
                    layout.printCopies === n
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  {n}x
                </button>
              ))}
              <span className="text-muted-foreground font-mono text-sm">
                {layout.printCopies === 1 ? "1 copia por pedido" : `${layout.printCopies} copias por pedido`}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Cupom 1 */}
        <Card className="bg-card border-border">
          <CardHeader className="border-b border-border/50 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center text-lg font-mono tracking-wider uppercase text-foreground">
                  <FileText className="w-5 h-5 mr-3 text-secondary" />
                  Cupom 1 — Completo
                </CardTitle>
                <CardDescription className="font-mono text-xs text-muted-foreground mt-1">Full receipt for the customer</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={layout.showCupom1} onCheckedChange={v => setLayout(p => ({ ...p, showCupom1: v }))} />
                <Label className="font-mono text-xs uppercase">Enabled</Label>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6 grid grid-cols-2 md:grid-cols-3 gap-4">
            {Object.entries(layout.cupom1Fields).map(([field, value]) => (
              <div key={field} className="flex items-center gap-2">
                <Switch checked={value as boolean} onCheckedChange={v => setCupom1(field, v)} />
                <Label className="font-mono text-xs uppercase tracking-wider text-muted-foreground cursor-pointer">
                  {field.replace("show", "").replace(/([A-Z])/g, " $1").trim()}
                </Label>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Cupom 2 */}
        <Card className="bg-card border-border">
          <CardHeader className="border-b border-border/50 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center text-lg font-mono tracking-wider uppercase text-foreground">
                  <ChefHat className="w-5 h-5 mr-3 text-primary" />
                  Cupom 2 — Cozinha
                </CardTitle>
                <CardDescription className="font-mono text-xs text-muted-foreground mt-1">Kitchen slip with order details</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={layout.showCupom2} onCheckedChange={v => setLayout(p => ({ ...p, showCupom2: v }))} />
                <Label className="font-mono text-xs uppercase">Enabled</Label>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6 grid grid-cols-2 md:grid-cols-3 gap-4">
            {Object.entries(layout.cupom2Fields).map(([field, value]) => (
              <div key={field} className="flex items-center gap-2">
                <Switch checked={value as boolean} onCheckedChange={v => setCupom2(field, v)} />
                <Label className="font-mono text-xs uppercase tracking-wider text-muted-foreground cursor-pointer">
                  {field.replace("show", "").replace(/([A-Z])/g, " $1").trim()}
                </Label>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} size="lg" className="font-mono uppercase tracking-wider font-bold">
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Saving..." : "Save Layout"}
          </Button>
        </div>
      </div>
    </div>
  );
}
