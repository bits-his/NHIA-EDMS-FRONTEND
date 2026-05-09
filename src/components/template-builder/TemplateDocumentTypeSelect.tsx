import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { TEMPLATE_DOCUMENT_GROUPS } from './constants';

interface TemplateDocumentTypeSelectProps {
  value: string;
  onValueChange: (v: string) => void;
  id?: string;
}

export function TemplateDocumentTypeSelect({ value, onValueChange, id }: TemplateDocumentTypeSelectProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-medium">
        Template Document Type
      </Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger id={id} className="h-11 text-left">
          <SelectValue placeholder="Select a government document template class…" />
        </SelectTrigger>
        <SelectContent className="max-h-[min(70vh,28rem)]">
          {TEMPLATE_DOCUMENT_GROUPS.map((group) => (
            <SelectGroup key={group.label}>
              <SelectLabel className="text-xs text-primary font-semibold pt-2 px-2">
                {group.label}
              </SelectLabel>
              {group.items.map((item) => (
                <SelectItem key={item.value} value={item.value} className="text-sm">
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
