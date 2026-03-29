export interface Vente {
  id: number;
  clientId: number;
  clientNom?: string;
  dateVente: Date;
  montantTotal: number;
  statut: 'en_attente' | 'validee' | 'annulee';
  articles: VenteArticle[];
}

export interface VenteArticle {
  articleId: number;
  articleNom?: string;
  quantite: number;
  prixUnitaire: number;
  sousTotal: number;
}