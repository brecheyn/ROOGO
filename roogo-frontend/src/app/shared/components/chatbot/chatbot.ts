import { Component, signal, computed, ElementRef, ViewChild, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { ApiService } from '../../../core/services/api.service';
import { ChatFormatPipe } from '../../../shared/pipes/chat-format.pipe';

interface ChatMessage {
  role: 'user' | 'bot';
  text: string;
  timestamp: Date;
}

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatInputModule, MatFormFieldModule, ChatFormatPipe],
  templateUrl: './chatbot.html',
  styleUrls: ['./chatbot.scss'],
})
export class ChatbotComponent implements AfterViewChecked {
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  isOpen = signal(false);
  isLoading = signal(false);
  userInput = signal('');
  messages = signal<ChatMessage[]>([
    {
      role: 'bot',
      text: 'Bonjour ! Je suis l\'assistant ROOGO. Essayez : "stock de [produit]", "combien ai-je vendu ce mois ?", "chiffre d\'affaires des 7 derniers jours", "top ventes", "alertes stock", "valeur du stock". Le contexte est mémorisé : après "stock de riz", demandez simplement "et le prix ?". Tapez "aide" pour tout voir.',
      timestamp: new Date(),
    }
  ]);

  private shouldScroll = false;

  ngAfterViewChecked() {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  toggle() {
    this.isOpen.update(v => !v);
  }

  async sendMessage() {
    const text = this.userInput().trim();
    if (!text || this.isLoading()) return;

    this.messages.update(msgs => [...msgs, { role: 'user', text, timestamp: new Date() }]);
    this.userInput.set('');
    this.isLoading.set(true);
    this.shouldScroll = true;

    this.api.aiChat(text).subscribe({
      next: (res) => {
        const botText = res?.data?.response || 'Désolé, je n\'ai pas pu traiter votre demande.';
        this.messages.update(msgs => [...msgs, { role: 'bot', text: botText, timestamp: new Date() }]);
        this.isLoading.set(false);
        this.shouldScroll = true;
      },
      error: () => {
        this.messages.update(msgs => [...msgs, {
          role: 'bot',
          text: 'Erreur de connexion. Veuillez réessayer.',
          timestamp: new Date(),
        }]);
        this.isLoading.set(false);
        this.shouldScroll = true;
      }
    });
  }

  onKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  private scrollToBottom() {
    try {
      const el = this.scrollContainer?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    } catch {}
  }

  formatTime(date: Date): string {
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  constructor(private api: ApiService) {}
}
