
export interface Article {
  id: number;
  nom: string;
  description?: string;
  prix?: number;
  stock?: number;
  categorie: string;
  image?: string;
  date_manufacture?: string;  // facultatif
  expiration_date?: string;   // facultatif
}
