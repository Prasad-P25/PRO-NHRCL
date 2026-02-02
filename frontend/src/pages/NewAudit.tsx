import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { auditService } from '@/services/audit.service';
import type { AuditType, CreateAuditForm } from '@/types';

export function NewAuditPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<CreateAuditForm>({
    packageId: 0,
    auditType: 'Full',
    categoryIds: [],
    scheduledDate: new Date().toISOString().split('T')[0],
    contractorRep: '',
  });

  const { data: packages = [], isLoading: packagesLoading, isError: packagesError, refetch: refetchPackages } = useQuery({
    queryKey: ['packages'],
    queryFn: async () => {
      const response = await auditService.getPackages();
      return response.data;
    },
  });

  const { data: categories = [], isLoading: categoriesLoading, isError: categoriesError, refetch: refetchCategories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await auditService.getCategories();
      return response.data;
    },
  });

  const isLoading = packagesLoading || categoriesLoading;
  const isError = packagesError || categoriesError;

  const createAuditMutation = useMutation({
    mutationFn: auditService.createAudit,
    onSuccess: (data) => {
      navigate(`/audits/${data.data.id}/execute`);
    },
  });

  const packagesArray = Array.isArray(packages) ? packages : [];
  const categoriesArray = Array.isArray(categories) ? categories : [];

  const selectedPackage = packagesArray.find((p) => p.id === formData.packageId);
  const totalItems = formData.auditType === 'Full'
    ? categoriesArray.reduce((sum, cat) => sum + (cat.itemCount || 0), 0)
    : categoriesArray
        .filter((cat) => formData.categoryIds.includes(cat.id))
        .reduce((sum, cat) => sum + (cat.itemCount || 0), 0);

  const handleCategoryToggle = (categoryId: number) => {
    setFormData((prev) => ({
      ...prev,
      categoryIds: prev.categoryIds.includes(categoryId)
        ? prev.categoryIds.filter((id) => id !== categoryId)
        : [...prev.categoryIds, categoryId],
    }));
  };

  const handleSelectAll = () => {
    setFormData((prev) => ({
      ...prev,
      categoryIds: categoriesArray.map((cat) => cat.id),
    }));
  };

  const handleDeselectAll = () => {
    setFormData((prev) => ({
      ...prev,
      categoryIds: [],
    }));
  };

  const handleSubmit = () => {
    const submitData = {
      ...formData,
      categoryIds: formData.auditType === 'Full' ? categoriesArray.map((c) => c.id) : formData.categoryIds,
    };
    createAuditMutation.mutate(submitData);
  };

  const canProceedStep1 = formData.packageId > 0 && formData.scheduledDate;
  const canProceedStep2 = formData.auditType === 'Full' || formData.categoryIds.length > 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Failed to load data</CardTitle>
            <CardDescription>
              Unable to load packages or categories from the server.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button onClick={() => { refetchPackages(); refetchCategories(); }} variant="outline" className="w-full">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
            <Button onClick={() => navigate('/audits')} variant="ghost" className="w-full">
              Back to Audits
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/audits')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">New Audit</h1>
          <p className="text-muted-foreground">Step {step} of 3</p>
        </div>
      </div>

      {/* Progress indicator */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                s === step
                  ? 'bg-primary text-primary-foreground'
                  : s < step
                  ? 'bg-compliant text-white'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {s < step ? <Check className="h-4 w-4" /> : s}
            </div>
            {s < 3 && (
              <div
                className={`h-1 w-16 ${s < step ? 'bg-compliant' : 'bg-muted'}`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Package & Type */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Package & Audit Type</CardTitle>
            <CardDescription>
              Select the package and type of audit you want to conduct
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="package">Package / Site *</Label>
              <Select
                value={formData.packageId.toString()}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, packageId: parseInt(value) }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a package" />
                </SelectTrigger>
                <SelectContent>
                  {packagesArray.map((pkg) => (
                    <SelectItem key={pkg.id} value={pkg.id.toString()}>
                      {pkg.code} - {pkg.name} ({pkg.location})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Audit Type *</Label>
              <div className="space-y-2">
                {[
                  { value: 'Full', label: 'Full Audit', desc: 'All 18 categories (~660 items)' },
                  { value: 'Partial', label: 'Partial Audit', desc: 'Select specific categories' },
                  { value: 'Focused', label: 'Focused Audit', desc: 'Single category deep-dive' },
                ].map((type) => (
                  <label
                    key={type.value}
                    className={`flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors ${
                      formData.auditType === type.value
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-muted'
                    }`}
                  >
                    <input
                      type="radio"
                      name="auditType"
                      value={type.value}
                      checked={formData.auditType === type.value}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          auditType: e.target.value as AuditType,
                        }))
                      }
                      className="mt-1"
                    />
                    <div>
                      <div className="font-medium">{type.label}</div>
                      <div className="text-sm text-muted-foreground">{type.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="date">Scheduled Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.scheduledDate}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, scheduledDate: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contractor">Contractor Representative</Label>
                <Input
                  id="contractor"
                  placeholder="Enter name"
                  value={formData.contractorRep}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, contractorRep: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => navigate('/audits')}>
                Cancel
              </Button>
              <Button onClick={() => setStep(2)} disabled={!canProceedStep1}>
                Next: Select Categories
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Category Selection */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Select Categories</CardTitle>
                <CardDescription>
                  Package: {selectedPackage?.code} - {selectedPackage?.name} | Type:{' '}
                  {formData.auditType}
                </CardDescription>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">{totalItems}</div>
                <div className="text-sm text-muted-foreground">items selected</div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {formData.auditType !== 'Full' && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleSelectAll}>
                  Select All
                </Button>
                <Button variant="outline" size="sm" onClick={handleDeselectAll}>
                  Deselect All
                </Button>
              </div>
            )}

            <div className="grid gap-2">
              {categoriesArray.map((category) => (
                <label
                  key={category.id}
                  className={`flex items-center justify-between rounded-lg border p-4 transition-colors ${
                    formData.auditType === 'Full' || formData.categoryIds.includes(category.id)
                      ? 'border-primary bg-primary/5'
                      : 'hover:bg-muted'
                  } ${formData.auditType === 'Full' ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={
                        formData.auditType === 'Full' ||
                        formData.categoryIds.includes(category.id)
                      }
                      disabled={formData.auditType === 'Full'}
                      onCheckedChange={() => handleCategoryToggle(category.id)}
                    />
                    <span>
                      {category.code}. {category.name}
                    </span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    ({category.itemCount} items)
                  </span>
                </label>
              ))}
            </div>

            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => navigate('/audits')}>
                  Cancel
                </Button>
                <Button onClick={() => setStep(3)} disabled={!canProceedStep2}>
                  Next: Review
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Review */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Review & Create</CardTitle>
            <CardDescription>Review your audit setup before creating</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-lg border p-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <div className="text-sm text-muted-foreground">Package</div>
                  <div className="font-medium">
                    {selectedPackage?.code} - {selectedPackage?.name}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Audit Type</div>
                  <div className="font-medium">{formData.auditType}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Scheduled Date</div>
                  <div className="font-medium">{formData.scheduledDate}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Contractor Rep</div>
                  <div className="font-medium">{formData.contractorRep || '-'}</div>
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-2">Categories</div>
                <div className="flex flex-wrap gap-2">
                  {formData.auditType === 'Full'
                    ? categoriesArray.map((cat) => (
                        <span
                          key={cat.id}
                          className="rounded-full bg-primary/10 px-3 py-1 text-sm"
                        >
                          {cat.code}. {cat.name}
                        </span>
                      ))
                    : categoriesArray
                        .filter((cat) => formData.categoryIds.includes(cat.id))
                        .map((cat) => (
                          <span
                            key={cat.id}
                            className="rounded-full bg-primary/10 px-3 py-1 text-sm"
                          >
                            {cat.code}. {cat.name}
                          </span>
                        ))}
                </div>
              </div>
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="text-sm text-muted-foreground">Total Items</div>
                <div className="text-2xl font-bold">{totalItems}</div>
              </div>
            </div>

            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => navigate('/audits')}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={createAuditMutation.isPending}
                >
                  {createAuditMutation.isPending ? 'Creating...' : 'Create & Start Audit'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
