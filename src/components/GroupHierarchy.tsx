import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronDown, FolderTree, Inbox, Users } from "lucide-react";

type GroupNode = {
  id: string;
  name: string;
  kind: "structural" | "operational";
  parent_id: string | null;
  member_count?: number;
  on_duty_count?: number;
  children?: GroupNode[];
};

interface GroupHierarchyProps {
  groups: GroupNode[];
  onSelectGroup?: (group: GroupNode) => void;
  selectedGroupId?: string;
}

export function GroupHierarchy({ groups, onSelectGroup, selectedGroupId }: GroupHierarchyProps) {
  return (
    <div className="space-y-1">
      {groups.map((group) => (
        <GroupNode
          key={group.id}
          group={group}
          level={0}
          onSelectGroup={onSelectGroup}
          selectedGroupId={selectedGroupId}
        />
      ))}
    </div>
  );
}

interface GroupNodeProps {
  group: GroupNode;
  level: number;
  onSelectGroup?: (group: GroupNode) => void;
  selectedGroupId?: string;
}

function GroupNode({ group, level, onSelectGroup, selectedGroupId }: GroupNodeProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = group.children && group.children.length > 0;

  return (
    <div>
      <div
        className={`flex items-center gap-2 py-2 px-3 rounded-md cursor-pointer hover:bg-accent transition-colors ${
          selectedGroupId === group.id ? "bg-accent border-l-2 border-primary" : ""
        }`}
        style={{ paddingLeft: `${level * 24 + 12}px` }}
        onClick={() => onSelectGroup?.(group)}
      >
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="p-0 h-4 w-4 hover:bg-accent-foreground/10 rounded"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        ) : (
          <div className="w-4" />
        )}

        {group.kind === "operational" ? (
          <Inbox className="h-4 w-4 text-primary" />
        ) : (
          <FolderTree className="h-4 w-4 text-muted-foreground" />
        )}

        <span className="font-medium flex-1">{group.name}</span>

        <div className="flex items-center gap-2">
          <Badge
            variant={group.kind === "operational" ? "default" : "secondary"}
            className="text-xs"
          >
            {group.kind === "operational" ? "Operativ" : "Strukturell"}
          </Badge>

          {group.member_count !== undefined && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground ml-2">
              <Users className="h-3 w-3" />
              <span>{group.member_count}</span>
            </div>
          )}

          {group.kind === "operational" && group.on_duty_count !== undefined && group.on_duty_count > 0 && (
            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
              {group.on_duty_count} på vakt
            </Badge>
          )}
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div>
          {group.children!.map((child) => (
            <GroupNode
              key={child.id}
              group={child}
              level={level + 1}
              onSelectGroup={onSelectGroup}
              selectedGroupId={selectedGroupId}
            />
          ))}
        </div>
      )}
    </div>
  );
}