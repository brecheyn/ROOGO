import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'filterByCondition',
  standalone: true
})
export class FilterByConditionPipe<T> implements PipeTransform {
  transform(
    items: T[] | null,
    field: keyof T,
    operator: '<' | '>' | '<=' | '>=' | '==' | '!=' | '===' | '!==',
    value: any
  ): T[] {
    if (!items) return [];

    return items.filter(item => {
      const itemValue = item[field] as any;
      if (itemValue == null) return false;

      switch (operator) {
        case '<': return itemValue < value;
        case '>': return itemValue > value;
        case '<=': return itemValue <= value;
        case '>=': return itemValue >= value;
        case '==': return itemValue == value;
        case '!=': return itemValue != value;
        case '===': return itemValue === value;
        case '!==': return itemValue !== value;
      }
    });
  }
}
