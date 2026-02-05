import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { MatDialog } from '@angular/material/dialog';

import { WorkContextType } from '../../features/work-context/work-context.model';
import { WorkContextService } from '../../features/work-context/work-context.service';
import { TagService } from '../../features/tag/tag.service';
import { ShepherdService } from '../../features/shepherd/shepherd.service';
import { TourId } from '../../features/shepherd/shepherd-steps.const';
import { T } from '../../t.const';
import { LS } from '../../core/persistence/storage-keys.const';
import { DialogCreateProjectComponent } from '../../features/project/dialogs/create-project/dialog-create-project.component';
import { getGithubErrorUrl } from '../../core/error-handler/global-error-handler.util';
import { DialogPromptComponent } from '../../ui/dialog-prompt/dialog-prompt.component';
import {
  DialogCreateTagComponent,
  CreateTagData,
} from '../../ui/dialog-create-tag/dialog-create-tag.component';
import {
  selectAllProjectsExceptInbox,
  selectUnarchivedProjects,
  selectUnarchivedVisibleProjects,
} from '../../features/project/store/project.selectors';
import { toggleHideFromMenu } from '../../features/project/store/project.actions';
import { NavConfig, NavItem } from './magic-side-nav.model';
import { PluginBridgeService } from '../../plugins/plugin-bridge.service';
import { PluginService } from '../../plugins/plugin.service';
import { lsGetBoolean, lsSetItem } from '../../util/ls-util';
import { MenuTreeService } from '../../features/menu-tree/menu-tree.service';
import { MenuTreeViewNode } from '../../features/menu-tree/store/menu-tree.model';
import { GlobalConfigService } from '../../features/config/global-config.service';

@Injectable({
  providedIn: 'root',
})
export class MagicNavConfigService {
  private readonly _workContextService = inject(WorkContextService);
  private readonly _tagService = inject(TagService);
  private readonly _shepherdService = inject(ShepherdService);
  private readonly _matDialog = inject(MatDialog);
  private readonly _store = inject(Store);
  private readonly _pluginBridge = inject(PluginBridgeService);
  private readonly _pluginService = inject(PluginService);
  private readonly _menuTreeService = inject(MenuTreeService);
  private readonly _configService = inject(GlobalConfigService);

  // Simple state signals
  private readonly _isProjectsExpanded = signal(
    lsGetBoolean(LS.IS_PROJECT_LIST_EXPANDED, true),
  );
  private readonly _isTagsExpanded = signal(lsGetBoolean(LS.IS_TAG_LIST_EXPANDED, true));

  // Data signals
  private readonly _mainWorkContext = toSignal(
    this._workContextService.mainWorkContext$,
    { initialValue: null },
  );
  private readonly _inboxContext = toSignal(this._workContextService.inboxWorkContext$, {
    initialValue: null,
  });
  private readonly _visibleProjects = toSignal(
    this._store.select(selectUnarchivedVisibleProjects),
    { initialValue: [] },
  );

  private readonly _allProjectsExceptInbox = toSignal(
    this._store.select(selectAllProjectsExceptInbox),
    { initialValue: [] },
  );
  private readonly _allUnarchivedProjects = toSignal(
    this._store.select(selectUnarchivedProjects),
    { initialValue: [] },
  );
  private readonly _tags = toSignal(this._tagService.tagsNoMyDayAndNoList$, {
    initialValue: [],
  });
  private readonly _projectNavTree = computed<MenuTreeViewNode[]>(() =>
    this._menuTreeService.buildProjectViewTree(this._visibleProjects()),
  );
  private readonly _tagNavTree = computed<MenuTreeViewNode[]>(() =>
    this._menuTreeService.buildTagViewTree(this._tags()),
  );
  private readonly _pluginMenuEntries = this._pluginBridge.menuEntries;
  private readonly isSchedulerEnabled = computed(
    () => this._configService.appFeatures().isSchedulerEnabled,
  );
  private readonly isPlannerEnabled = computed(
    () => this._configService.appFeatures().isPlannerEnabled,
  );
  private readonly isBoardsEnabled = computed(
    () => this._configService.appFeatures().isBoardsEnabled,
  );
  private readonly isDonatePageEnabled = computed(
    () => this._configService.appFeatures().isDonatePageEnabled,
  );
  private readonly isHabitsEnabled = computed(
    () => this._configService.appFeatures().isHabitsEnabled,
  );

  constructor() {
    // TODO these should probably live in the _menuTreeService
    effect(() => {
      const projects = this._visibleProjects();
      if (projects.length && !this._menuTreeService.hasProjectTree()) {
        this._menuTreeService.initializeProjectTree(projects);
      }
    });

    // TODO these should probably live in the _menuTreeService
    effect(() => {
      const tags = this._tags();
      if (tags.length && !this._menuTreeService.hasTagTree()) {
        this._menuTreeService.initializeTagTree(tags);
      }
    });
  }

  // Main navigation configuration
  readonly navConfig = computed<NavConfig>(() => ({
    items: [
      // Work Context Items
      ...this._buildWorkContextItems(),

      // Separator

      // Main Routes
      ...this._buildMainRoutesItems(),

      // Plugin entries
      ...this._buildPluginItems(),

      // Separator before settings (pushes settings to bottom)
      { type: 'separator', id: 'sep-3', mtAuto: true },

      {
        type: 'route',
        id: 'settings',
        label: T.MH.SETTINGS,
        icon: 'settings',
        route: '/config',
        tourClass: 'tour-settingsMenuBtn',
      },
    ],
    fullModeByDefault: false,
    showLabels: false,
    mobileBreakpoint: 600,
    resizable: false,
    minWidth: 72,
    maxWidth: 72,
    defaultWidth: 72,
    collapseThreshold: 64,
    expandThreshold: 80,
  }));

  // Simple action handler
  onNavItemClick(item: NavItem): void {
    switch (item.type) {
      case 'href':
        window.open(item.href, '_blank');
        break;
      case 'action':
        item.action?.();
        break;
      default:
        // Routes and groups handled elsewhere
        break;
    }
  }

  // Private helpers
  private _buildWorkContextItems(): NavItem[] {
    const items: NavItem[] = [];
    const mainContext = this._mainWorkContext();
    const inboxContext = this._inboxContext();

    if (mainContext) {
      items.push({
        type: 'workContext',
        id: `main-${mainContext.id}`,
        label: mainContext.title,
        icon: mainContext.icon || 'today',
        route: `/tag/${mainContext.id}/tasks`,
        workContext: mainContext,
        workContextType: WorkContextType.TAG,
        defaultIcon: 'today',
      });
    }

    if (inboxContext) {
      items.push({
        type: 'workContext',
        id: `inbox-${inboxContext.id}`,
        label: inboxContext.title,
        icon: inboxContext.icon || 'inbox',
        route: `/project/${inboxContext.id}/tasks`,
        workContext: inboxContext,
        workContextType: WorkContextType.PROJECT,
        defaultIcon: 'inbox',
      });
    }

    return items;
  }

  private _buildMainRoutesItems(): NavItem[] {
    const items: NavItem[] = [];

    if (this.isPlannerEnabled()) {
      items.push({
        type: 'route',
        id: 'planner',
        label: T.MH.PLANNER,
        icon: 'edit_calendar',
        route: '/planner',
      });
    }

    if (this.isSchedulerEnabled()) {
      items.push({
        type: 'route',
        id: 'schedule',
        label: T.MH.SCHEDULE,
        icon: 'schedule',
        route: '/schedule',
      });
    }

    if (this.isBoardsEnabled()) {
      items.push({
        type: 'route',
        id: 'boards',
        label: T.MH.BOARDS,
        icon: 'grid_view',
        route: '/boards',
      });
    }

    if (this.isHabitsEnabled()) {
      items.push({
        type: 'route',
        id: 'habits',
        label: T.MH.HABITS,
        icon: 'check_box',
        svgIcon: 'habit',
        route: '/habits',
      });
    }

    return items;
  }

  private _buildPluginItems(): NavItem[] {
    const pluginEntries = this._pluginMenuEntries();
    const pluginStates = this._pluginService.getAllPluginStates();
    const pluginIcons = this._pluginService.getPluginIconsSignal()();

    return pluginEntries.map((entry) => {
      // Prefer custom SVG icon if available, otherwise check if entry.icon is SVG path
      const hasCustomSvgIcon = pluginIcons.has(entry.pluginId);
      const isIconSvgPath = /\.svg$/i.test(entry.icon || '');
      const isUploadedPlugin = pluginStates.get(entry.pluginId)?.type === 'uploaded';

      let svgIcon: string | undefined;
      if (hasCustomSvgIcon) {
        svgIcon = `plugin-${entry.pluginId}-icon`;
      } else if (isIconSvgPath && !isUploadedPlugin) {
        svgIcon = `assets/bundled-plugins/${entry.pluginId}/${entry.icon}`;
      }

      return {
        type: 'plugin' as const,
        id: `plugin-${entry.pluginId}-${entry.label}`,
        label: entry.label,
        icon: entry.icon || 'extension',
        ...(svgIcon && { svgIcon }),
        pluginId: entry.pluginId,
        action: entry.onClick,
      };
    });
  }

  // Public computed signals for expansion state (for component to check)
  readonly isProjectsExpanded = computed(() => this._isProjectsExpanded());
  readonly isTagsExpanded = computed(() => this._isTagsExpanded());

  // Public access to projects for visibility menu
  readonly allProjectsExceptInbox = computed(() => this._allProjectsExceptInbox());
  readonly allUnarchivedProjects = computed(() => this._allUnarchivedProjects());

  // Check if there are any projects or tags (for empty state)
  readonly hasAnyProjects = computed(() => this._visibleProjects().length > 0);
  readonly hasAnyTags = computed(() => this._tags().length > 0);

  // Simple toggle functions
  private _toggleProjectsExpanded(): void {
    const newState = !this._isProjectsExpanded();
    this._isProjectsExpanded.set(newState);
    lsSetItem(LS.IS_PROJECT_LIST_EXPANDED, newState);
  }

  private _toggleTagsExpanded(): void {
    const newState = !this._isTagsExpanded();
    this._isTagsExpanded.set(newState);
    lsSetItem(LS.IS_TAG_LIST_EXPANDED, newState);
  }

  // Simple action handlers
  private _openCreateProject(): void {
    this._matDialog.open(DialogCreateProjectComponent, { restoreFocus: true });
  }

  private _openCreateProjectFolder(): void {
    this._matDialog
      .open(DialogPromptComponent, {
        restoreFocus: true,
        data: {
          placeholder: T.F.PROJECT_FOLDER.DIALOG.NAME_PLACEHOLDER,
        },
      })
      .afterClosed()
      .subscribe((title) => {
        if (!title) {
          return;
        }
        const trimmed = title.trim();
        if (!trimmed) {
          return;
        }
        this._menuTreeService.createProjectFolder(trimmed);
      });
  }

  private _openCreateTagFolder(): void {
    this._matDialog
      .open(DialogPromptComponent, {
        restoreFocus: true,
        data: {
          placeholder: T.F.TAG_FOLDER.DIALOG.NAME_PLACEHOLDER,
        },
      })
      .afterClosed()
      .subscribe((title) => {
        if (!title) {
          return;
        }
        const trimmed = title.trim();
        if (!trimmed) {
          return;
        }
        this._menuTreeService.createTagFolder(trimmed);
      });
  }

  private _createNewTag(): void {
    this._matDialog
      .open(DialogCreateTagComponent, {
        restoreFocus: true,
      })
      .afterClosed()
      .subscribe((result: CreateTagData) => {
        if (result && result.title) {
          this._tagService.addTag({
            title: result.title,
            icon: result.icon,
            color: result.color,
          });
        }
      });
  }

  private _openBugReport(): void {
    window.open(getGithubErrorUrl('', undefined, true), '_blank');
  }

  private _startTour(tourId: TourId): void {
    void this._shepherdService.show(tourId);
  }

  private _openProjectVisibilityMenu(): void {
    // Project visibility is handled by the nav-list component's additional buttons
    // This method is called but the actual menu is rendered in the template
  }

  toggleProjectVisibility(projectId: string): void {
    this._store.dispatch(toggleHideFromMenu({ id: projectId }));
  }

  // Public methods for empty states
  createNewProject(): void {
    this._openCreateProject();
  }

  createNewTag(): void {
    this._createNewTag();
  }
}
