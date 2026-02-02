import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Edit,
  Trash2,
  FolderOpen,
  FileText,
  ListChecks,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

import settingsService from '@/services/settings.service';
import type { AuditCategory, AuditSection, AuditItem } from '@/types';

type DialogType = 'category' | 'section' | 'item' | null;

export function ChecklistManagementPage() {
  const queryClient = useQueryClient();

  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [dialogType, setDialogType] = useState<DialogType>(null);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});

  // Fetch categories
  const { data: categoriesData, isLoading: loadingCategories } = useQuery({
    queryKey: ['audit-categories'],
    queryFn: () => settingsService.getCategories(),
  });

  // Fetch selected category details
  const { data: categoryDetail } = useQuery({
    queryKey: ['audit-category', selectedCategoryId],
    queryFn: () => settingsService.getCategoryById(selectedCategoryId!),
    enabled: !!selectedCategoryId,
  });

  // Mutations
  const createCategoryMutation = useMutation({
    mutationFn: (data: Partial<AuditCategory>) => settingsService.createCategory(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audit-categories'] });
      closeDialog();
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<AuditCategory> }) =>
      settingsService.updateCategory(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audit-categories'] });
      queryClient.invalidateQueries({ queryKey: ['audit-category', selectedCategoryId] });
      closeDialog();
    },
  });

  const createSectionMutation = useMutation({
    mutationFn: (data: any) => settingsService.createSection(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audit-category', selectedCategoryId] });
      closeDialog();
    },
  });

  const updateSectionMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      settingsService.updateSection(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audit-category', selectedCategoryId] });
      closeDialog();
    },
  });

  const deleteSectionMutation = useMutation({
    mutationFn: (id: number) => settingsService.deleteSection(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audit-category', selectedCategoryId] });
    },
  });

  const createItemMutation = useMutation({
    mutationFn: (data: any) => settingsService.createItem(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audit-category', selectedCategoryId] });
      closeDialog();
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      settingsService.updateItem(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audit-category', selectedCategoryId] });
      closeDialog();
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: (id: number) => settingsService.deleteItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audit-category', selectedCategoryId] });
    },
  });

  const closeDialog = () => {
    setDialogType(null);
    setEditingItem(null);
    setFormData({});
  };

  const openCategoryDialog = (category?: AuditCategory) => {
    setEditingItem(category || null);
    setFormData(
      category
        ? {
            code: category.code,
            name: category.name,
            fullTitle: category.fullTitle,
            description: category.description,
            type: category.type,
            displayOrder: category.displayOrder,
          }
        : {}
    );
    setDialogType('category');
  };

  const openSectionDialog = (section?: AuditSection) => {
    setEditingItem(section || null);
    setFormData(
      section
        ? { code: section.code, name: section.name, displayOrder: section.displayOrder }
        : { categoryId: selectedCategoryId }
    );
    setDialogType('section');
  };

  const openItemDialog = (sectionId: number, item?: AuditItem) => {
    setEditingItem(item || null);
    setFormData(
      item
        ? {
            srNo: item.srNo,
            auditPoint: item.auditPoint,
            standardReference: item.standardReference,
            evidenceRequired: item.evidenceRequired,
            priority: item.priority,
          }
        : { sectionId }
    );
    setDialogType('item');
  };

  const handleSubmit = () => {
    if (dialogType === 'category') {
      if (editingItem) {
        updateCategoryMutation.mutate({ id: editingItem.id, data: formData });
      } else {
        createCategoryMutation.mutate(formData);
      }
    } else if (dialogType === 'section') {
      if (editingItem) {
        updateSectionMutation.mutate({ id: editingItem.id, data: formData });
      } else {
        createSectionMutation.mutate(formData);
      }
    } else if (dialogType === 'item') {
      if (editingItem) {
        updateItemMutation.mutate({ id: editingItem.id, data: formData });
      } else {
        createItemMutation.mutate(formData);
      }
    }
  };

  const categories = categoriesData?.data || [];
  const category = categoryDetail?.data;

  // Stats
  const stats = {
    categories: categories.length,
    sections: category?.sections?.length || 0,
    items: category?.sections?.reduce((sum, s) => sum + (s.items?.length || 0), 0) || 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Checklist Management</h1>
          <p className="text-muted-foreground">Manage audit categories, sections, and items</p>
        </div>
        <Button onClick={() => openCategoryDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          Add Category
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categories</CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.categories}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sections</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.sections}</div>
            <p className="text-xs text-muted-foreground">in selected category</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Audit Items</CardTitle>
            <ListChecks className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.items}</div>
            <p className="text-xs text-muted-foreground">in selected category</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Categories List */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Categories</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingCategories ? (
              <div className="text-center py-4">Loading...</div>
            ) : (
              <div className="space-y-2">
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedCategoryId === cat.id
                        ? 'bg-primary/10 border-primary'
                        : 'hover:bg-muted'
                    }`}
                    onClick={() => setSelectedCategoryId(cat.id)}
                  >
                    <div>
                      <div className="font-medium">{cat.code}</div>
                      <div className="text-sm text-muted-foreground">{cat.name}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{cat.itemCount} items</Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          openCategoryDialog(cat);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {categories.length === 0 && (
                  <div className="text-center py-4 text-muted-foreground">
                    No categories found
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Category Details */}
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{category?.name || 'Select a Category'}</CardTitle>
              {category && (
                <p className="text-sm text-muted-foreground mt-1">{category.fullTitle}</p>
              )}
            </div>
            {category && (
              <Button size="sm" onClick={() => openSectionDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Add Section
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {!category ? (
              <div className="text-center py-8 text-muted-foreground">
                Select a category to view its sections and items
              </div>
            ) : (
              <Accordion type="multiple" className="space-y-2">
                {category.sections?.map((section) => (
                  <AccordionItem key={section.id} value={section.id.toString()} className="border rounded-lg">
                    <AccordionTrigger className="px-4 hover:no-underline">
                      <div className="flex items-center justify-between w-full pr-4">
                        <span className="font-medium">
                          {section.code}. {section.name}
                        </span>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{section.items?.length || 0} items</Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              openSectionDialog(section);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {(!section.items || section.items.length === 0) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteSectionMutation.mutate(section.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <div className="space-y-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openItemDialog(section.id)}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add Item
                        </Button>
                        <div className="space-y-2 mt-4">
                          {section.items?.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-start justify-between p-3 rounded border bg-muted/50"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">#{item.srNo}</span>
                                  <Badge variant={item.priority === 'P1' ? 'destructive' : 'secondary'}>
                                    {item.priority}
                                  </Badge>
                                </div>
                                <p className="text-sm mt-1">{item.auditPoint}</p>
                                {item.standardReference && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Ref: {item.standardReference}
                                  </p>
                                )}
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openItemDialog(section.id, item)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => deleteItemMutation.mutate(item.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </div>
                            </div>
                          ))}
                          {(!section.items || section.items.length === 0) && (
                            <div className="text-center py-4 text-muted-foreground text-sm">
                              No items in this section
                            </div>
                          )}
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
                {(!category.sections || category.sections.length === 0) && (
                  <div className="text-center py-8 text-muted-foreground">
                    No sections in this category
                  </div>
                )}
              </Accordion>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Category Dialog */}
      <Dialog open={dialogType === 'category'} onOpenChange={() => closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Category' : 'Add Category'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Code *</Label>
                <Input
                  value={formData.code || ''}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="e.g., 01"
                />
              </div>
              <div className="space-y-2">
                <Label>Display Order</Label>
                <Input
                  type="number"
                  value={formData.displayOrder || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, displayOrder: parseInt(e.target.value) })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Category name"
              />
            </div>
            <div className="space-y-2">
              <Label>Full Title</Label>
              <Input
                value={formData.fullTitle || ''}
                onChange={(e) => setFormData({ ...formData, fullTitle: e.target.value })}
                placeholder="Full descriptive title"
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={formData.type || ''}
                onValueChange={(v) => setFormData({ ...formData, type: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Compliance">Compliance</SelectItem>
                  <SelectItem value="System">System</SelectItem>
                  <SelectItem value="Process">Process</SelectItem>
                  <SelectItem value="Technical">Technical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => closeDialog()}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createCategoryMutation.isPending || updateCategoryMutation.isPending}
            >
              {editingItem ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Section Dialog */}
      <Dialog open={dialogType === 'section'} onOpenChange={() => closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Section' : 'Add Section'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Code *</Label>
                <Input
                  value={formData.code || ''}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="e.g., A"
                />
              </div>
              <div className="space-y-2">
                <Label>Display Order</Label>
                <Input
                  type="number"
                  value={formData.displayOrder || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, displayOrder: parseInt(e.target.value) })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Section name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => closeDialog()}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createSectionMutation.isPending || updateSectionMutation.isPending}
            >
              {editingItem ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Item Dialog */}
      <Dialog open={dialogType === 'item'} onOpenChange={() => closeDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Audit Item' : 'Add Audit Item'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sr No *</Label>
                <Input
                  type="number"
                  value={formData.srNo || ''}
                  onChange={(e) => setFormData({ ...formData, srNo: parseInt(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={formData.priority || 'P1'}
                  onValueChange={(v) => setFormData({ ...formData, priority: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="P1">P1 - Critical</SelectItem>
                    <SelectItem value="P2">P2 - Important</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Audit Point *</Label>
              <Textarea
                value={formData.auditPoint || ''}
                onChange={(e) => setFormData({ ...formData, auditPoint: e.target.value })}
                placeholder="What to check during audit"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Standard Reference</Label>
              <Input
                value={formData.standardReference || ''}
                onChange={(e) => setFormData({ ...formData, standardReference: e.target.value })}
                placeholder="e.g., ISO 45001:2018 Clause 5.2"
              />
            </div>
            <div className="space-y-2">
              <Label>Evidence Required</Label>
              <Input
                value={formData.evidenceRequired || ''}
                onChange={(e) => setFormData({ ...formData, evidenceRequired: e.target.value })}
                placeholder="What evidence to collect"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => closeDialog()}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createItemMutation.isPending || updateItemMutation.isPending}
            >
              {editingItem ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ChecklistManagementPage;
