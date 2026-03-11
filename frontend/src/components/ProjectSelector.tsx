import { useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { ChevronDown, Building2, Check, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAppStore } from '@/store/appStore';
import { toast } from '@/hooks/use-toast';
import projectService from '@/services/project.service';
import type { Project } from '@/types';

export function ProjectSelector() {
  const queryClient = useQueryClient();
  const { currentProject, setCurrentProject, setAvailableProjects } = useAppStore();

  // Fetch user's projects
  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectService.getUserProjects(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Set available projects and auto-select default on load
  useEffect(() => {
    if (projects && projects.length > 0) {
      setAvailableProjects(projects);

      // If no project is selected, select the default or first project
      if (!currentProject) {
        const defaultProject = projects.find((p) => p.isDefault) || projects[0];
        setCurrentProject(defaultProject);
      } else {
        // Verify current project is still in the list
        const stillValid = projects.find((p) => p.id === currentProject.id);
        if (!stillValid) {
          const defaultProject = projects.find((p) => p.isDefault) || projects[0];
          setCurrentProject(defaultProject);
        }
      }
    }
  }, [projects, currentProject, setCurrentProject, setAvailableProjects]);

  // Set default project mutation
  const setDefaultMutation = useMutation({
    mutationFn: (projectId: number) => projectService.setDefaultProject(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast({
        title: 'Default project updated',
        description: `${currentProject?.name} is now your default project`,
        variant: 'success',
      });
    },
    onError: () => {
      toast({
        title: 'Failed to set default',
        description: 'Could not update default project',
        variant: 'destructive',
      });
    },
  });

  const handleProjectChange = (project: Project) => {
    if (project.id !== currentProject?.id) {
      setCurrentProject(project);

      // Show toast notification
      toast({
        title: 'Project switched',
        description: `Now viewing ${project.name}`,
        variant: 'success',
      });

      // Invalidate all queries to refresh data for the new project
      queryClient.invalidateQueries();
    }
  };

  const handleSetDefault = () => {
    if (currentProject && !currentProject.isDefault) {
      setDefaultMutation.mutate(currentProject.id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2">
        <Building2 className="h-4 w-4 animate-pulse" />
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    );
  }

  if (!projects || projects.length === 0) {
    return null;
  }

  // Single project - just display it without dropdown
  if (projects.length === 1) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 border rounded-md bg-muted/50">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">{projects[0].name}</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2 max-w-[200px]">
          <Building2 className="h-4 w-4 flex-shrink-0" />
          <span className="truncate text-sm">
            {currentProject?.name || 'Select Project'}
          </span>
          <ChevronDown className="h-4 w-4 flex-shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[250px]">
        <DropdownMenuLabel>Switch Project</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {projects.map((project) => (
          <DropdownMenuItem
            key={project.id}
            onClick={() => handleProjectChange(project)}
            className="flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-2">
              {project.isDefault && (
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              )}
              <div className="flex flex-col">
                <span className="font-medium">{project.name}</span>
                <span className="text-xs text-muted-foreground">{project.code}</span>
              </div>
            </div>
            {currentProject?.id === project.id && (
              <Check className="h-4 w-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
        {currentProject && !currentProject.isDefault && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleSetDefault}
              disabled={setDefaultMutation.isPending}
              className="cursor-pointer"
            >
              <Star className="h-4 w-4 mr-2" />
              {setDefaultMutation.isPending ? 'Setting...' : 'Set as Default'}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
