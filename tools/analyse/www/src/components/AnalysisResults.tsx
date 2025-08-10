import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { EditableChip } from '@/components/ui/editable-chip';
import { 
  BookOpen, 
  Users, 
  MapPin, 
  Lightbulb, 
  Calendar, 
  Heart, 
  Tag,
  Plus,
  Download,
  Edit3
} from 'lucide-react';
import type { AnalysisResult } from '@/types/analysis';

interface AnalysisResultsProps {
  result: AnalysisResult;
  onResultChange: (result: AnalysisResult) => void;
}

export function AnalysisResults({ result, onResultChange }: AnalysisResultsProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingLevel, setIsEditingLevel] = useState(false);
  const [newChipInputs, setNewChipInputs] = useState<Record<string, string>>({});

  const updateResult = (updates: Partial<AnalysisResult>) => {
    onResultChange({ ...result, ...updates });
  };

  const handleChipEdit = (
    category: keyof AnalysisResult, 
    subcategory: 'primary' | 'secondary' | null,
    oldValue: string, 
    newValue: string
  ) => {
    if (category === 'keywords') {
      const newKeywords = [...result.keywords];
      const index = newKeywords.indexOf(oldValue);
      if (index !== -1) {
        newKeywords[index] = newValue;
        updateResult({ keywords: newKeywords });
      }
    } else if (subcategory && category !== 'story_title' && category !== 'level') {
      const categoryData = result[category] as { primary: string[]; secondary: string[] };
      const newCategoryData = { ...categoryData };
      const index = newCategoryData[subcategory].indexOf(oldValue);
      if (index !== -1) {
        newCategoryData[subcategory][index] = newValue;
        updateResult({ [category]: newCategoryData });
      }
    }
  };

  const handleChipDelete = (
    category: keyof AnalysisResult,
    subcategory: 'primary' | 'secondary' | null,
    value: string
  ) => {
    if (category === 'keywords') {
      const newKeywords = result.keywords.filter(k => k !== value);
      updateResult({ keywords: newKeywords });
    } else if (subcategory && category !== 'story_title' && category !== 'level') {
      const categoryData = result[category] as { primary: string[]; secondary: string[] };
      const newCategoryData = { ...categoryData };
      newCategoryData[subcategory] = newCategoryData[subcategory].filter((item: string) => item !== value);
      updateResult({ [category]: newCategoryData });
    }
  };

  const handleAddChip = (
    category: keyof AnalysisResult,
    subcategory: 'primary' | 'secondary' | null
  ) => {
    const inputKey = `${String(category)}-${subcategory}`;
    const newValue = newChipInputs[inputKey]?.trim();
    
    if (!newValue) return;

    if (category === 'keywords') {
      if (!result.keywords.includes(newValue)) {
        updateResult({ keywords: [...result.keywords, newValue] });
      }
    } else if (subcategory && category !== 'story_title' && category !== 'level') {
      const categoryData = result[category] as { primary: string[]; secondary: string[] };
      const newCategoryData = { ...categoryData };
      if (!newCategoryData[subcategory].includes(newValue)) {
        newCategoryData[subcategory] = [...newCategoryData[subcategory], newValue];
        updateResult({ [category]: newCategoryData });
      }
    }

    setNewChipInputs({ ...newChipInputs, [inputKey]: '' });
  };

  const handleInputChange = (key: string, value: string) => {
    setNewChipInputs({ ...newChipInputs, [key]: value });
  };

  const handleKeyPress = (
    e: React.KeyboardEvent, 
    category: keyof AnalysisResult,
    subcategory: 'primary' | 'secondary' | null
  ) => {
    if (e.key === 'Enter') {
      handleAddChip(category, subcategory);
    }
  };

  const exportResults = () => {
    const dataStr = JSON.stringify(result, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `story-analysis-${result.story_title?.replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'result'}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const renderChipSection = (
    title: string,
    icon: React.ReactNode,
    category: keyof AnalysisResult,
    subcategory: 'primary' | 'secondary' | null = null,
    items: string[]
  ) => {
    const inputKey = `${String(category)}-${subcategory}`;
    
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          {icon}
          <h4 className="font-medium text-sm">{title}</h4>
          <Badge variant="outline" className="text-xs">
            {items.length}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          {items.map((item, index) => (
            <EditableChip
              key={`${item}-${index}`}
              value={item}
              onEdit={(old, newVal) => handleChipEdit(category, subcategory, old, newVal)}
              onDelete={(val) => handleChipDelete(category, subcategory, val)}
              variant={subcategory === 'primary' ? 'default' : 'secondary'}
            />
          ))}
          <div className="flex items-center gap-1">
            <Input
              placeholder={`Add ${title.toLowerCase()}...`}
              value={newChipInputs[inputKey] || ''}
              onChange={(e) => handleInputChange(inputKey, e.target.value)}
              onKeyPress={(e) => handleKeyPress(e, category, subcategory)}
              className="h-6 px-2 text-xs w-32"
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleAddChip(category, subcategory)}
              className="h-6 w-6 p-0"
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            <CardTitle>Story Analysis Results</CardTitle>
          </div>
          <Button onClick={exportResults} size="sm" variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export JSON
          </Button>
        </div>
        <CardDescription>
          Click on any chip to edit it, or use the input fields to add new items
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Title and Level */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Story Title</label>
            {isEditingTitle ? (
              <div className="flex items-center gap-2">
                <Input
                  value={result.story_title || ''}
                  onChange={(e) => updateResult({ story_title: e.target.value })}
                  onBlur={() => setIsEditingTitle(false)}
                  onKeyPress={(e) => e.key === 'Enter' && setIsEditingTitle(false)}
                  className="h-8"
                  autoFocus
                />
              </div>
            ) : (
              <div 
                className="flex items-center gap-2 p-2 bg-muted rounded cursor-pointer hover:bg-muted/80"
                onClick={() => setIsEditingTitle(true)}
              >
                <span className="text-sm">
                  {result.story_title || 'Click to add title'}
                </span>
                <Edit3 className="h-3 w-3 text-muted-foreground" />
              </div>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Reading Level</label>
            {isEditingLevel ? (
              <div className="flex items-center gap-2">
                <Input
                  value={result.level || ''}
                  onChange={(e) => updateResult({ level: e.target.value })}
                  onBlur={() => setIsEditingLevel(false)}
                  onKeyPress={(e) => e.key === 'Enter' && setIsEditingLevel(false)}
                  className="h-8"
                  autoFocus
                />
              </div>
            ) : (
              <div 
                className="flex items-center gap-2 p-2 bg-muted rounded cursor-pointer hover:bg-muted/80"
                onClick={() => setIsEditingLevel(true)}
              >
                <span className="text-sm">
                  {result.level || 'Click to add level'}
                </span>
                <Edit3 className="h-3 w-3 text-muted-foreground" />
              </div>
            )}
          </div>
        </div>

        {/* Characters */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Users className="h-5 w-5" />
            Characters
          </h3>
          {renderChipSection(
            'Primary Characters',
            <Users className="h-4 w-4 text-blue-600" />,
            'characters',
            'primary',
            result.characters.primary
          )}
          {renderChipSection(
            'Secondary Characters',
            <Users className="h-4 w-4 text-gray-600" />,
            'characters',
            'secondary',
            result.characters.secondary
          )}
        </div>

        {/* Settings */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Settings
          </h3>
          {renderChipSection(
            'Primary Settings',
            <MapPin className="h-4 w-4 text-green-600" />,
            'settings',
            'primary',
            result.settings.primary
          )}
          {renderChipSection(
            'Secondary Settings',
            <MapPin className="h-4 w-4 text-gray-600" />,
            'settings',
            'secondary',
            result.settings.secondary
          )}
        </div>

        {/* Themes */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            Themes
          </h3>
          {renderChipSection(
            'Primary Themes',
            <Lightbulb className="h-4 w-4 text-yellow-600" />,
            'themes',
            'primary',
            result.themes.primary
          )}
          {renderChipSection(
            'Secondary Themes',
            <Lightbulb className="h-4 w-4 text-gray-600" />,
            'themes',
            'secondary',
            result.themes.secondary
          )}
        </div>

        {/* Events */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Events
          </h3>
          {renderChipSection(
            'Primary Events',
            <Calendar className="h-4 w-4 text-purple-600" />,
            'events',
            'primary',
            result.events.primary
          )}
          {renderChipSection(
            'Secondary Events',
            <Calendar className="h-4 w-4 text-gray-600" />,
            'events',
            'secondary',
            result.events.secondary
          )}
        </div>

        {/* Emotions */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Heart className="h-5 w-5" />
            Emotions
          </h3>
          {renderChipSection(
            'Primary Emotions',
            <Heart className="h-4 w-4 text-red-600" />,
            'emotions',
            'primary',
            result.emotions.primary
          )}
          {renderChipSection(
            'Secondary Emotions',
            <Heart className="h-4 w-4 text-gray-600" />,
            'emotions',
            'secondary',
            result.emotions.secondary
          )}
        </div>

        {/* Keywords */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Keywords
          </h3>
          {renderChipSection(
            'Keywords',
            <Tag className="h-4 w-4 text-indigo-600" />,
            'keywords',
            null,
            result.keywords
          )}
        </div>
      </CardContent>
    </Card>
  );
} 