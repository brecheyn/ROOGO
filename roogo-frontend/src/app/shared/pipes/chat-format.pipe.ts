import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'chatFormat', standalone: true })
export class ChatFormatPipe implements PipeTransform {
  transform(value: string): string {
    if (!value) return '';
    return value
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }
}
