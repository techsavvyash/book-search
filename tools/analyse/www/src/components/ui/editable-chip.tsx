import React, { useState, useRef, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Check, Edit2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EditableChipProps {
  value: string;
  onEdit: (oldValue: string, newValue: string) => void;
  onDelete: (value: string) => void;
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
  className?: string;
}

export function EditableChip({ 
  value, 
  onEdit, 
  onDelete, 
  variant = 'default',
  className 
}: EditableChipProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleEdit = () => {
    setIsEditing(true);
    setEditValue(value);
  };

  const handleSave = () => {
    if (editValue.trim() && editValue !== value) {
      onEdit(value, editValue.trim());
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const handleDelete = () => {
    onDelete(value);
  };

  if (isEditing) {
    return (
      <div className={cn("flex items-center gap-1 border rounded-md px-2 py-1", className)}>
        <Input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-6 px-1 text-xs border-none focus-visible:ring-0"
          size={editValue.length || 1}
        />
        <Button
          size="sm"
          variant="ghost"
          onClick={handleSave}
          className="h-5 w-5 p-0"
        >
          <Check className="h-3 w-3" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleCancel}
          className="h-5 w-5 p-0"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <Badge
      variant={variant}
      className={cn(
        "group relative pr-8 cursor-pointer hover:bg-opacity-80 transition-colors",
        className
      )}
      onClick={handleEdit}
    >
      <span className="truncate max-w-[200px]">{value}</span>
      <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          size="sm"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            handleEdit();
          }}
          className="h-4 w-4 p-0 hover:bg-white/20"
        >
          <Edit2 className="h-2.5 w-2.5" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            handleDelete();
          }}
          className="h-4 w-4 p-0 hover:bg-red-500/20"
        >
          <X className="h-2.5 w-2.5" />
        </Button>
      </div>
    </Badge>
  );
} 