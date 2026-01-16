
import { Department } from './types';

export const INITIAL_DEPARTMENTS: Record<string, Department> = {
  "dept-comm": {
    id: "dept-comm",
    name: "Commercial Local",
    sheetsData: {
      "sheet-comm-1": {
        id: "sheet-comm-1",
        service: "Service Commercial local",
        employees: ["Achouak", "Naima", "Ikbel"],
        tasks: [
          "Gestion des conventions et contrats clients",
          "Traitement et suivi des Commandes",
          "Traitement des factures retours",
          "Établissement des prévisions clients",
          "Traitement des réclamations Client",
          "Gestion des enquêtes de satisfaction",
          "Saisie des règlements clients sur SAGE",
          "Suivis de l'état de recouvrement",
          "Suivis des ventes mensuelles",
          "Préparation du rapport d'activité"
        ]
      }
    }
  },
  "dept-achat": {
    id: "dept-achat",
    name: "Service Achat",
    sheetsData: {
      "sheet-achat-1": {
        id: "sheet-achat-1",
        service: "Approvisionnement",
        employees: ["Mohamed Ali", "Ahmed Bane", "Imen Hamrouni"],
        tasks: [
          "Planification approvisionnement M.P.",
          "Coordination avec les fournisseurs",
          "Sélection et évaluation fournisseurs",
          "Saisie et suivi Mouvement journalier",
          "Traitement des produits non conformes",
          "Elaboration des Bons de Commandes",
          "Création d'un nouveau article sur SAGE",
          "Traitement réclamations fournisseurs"
        ]
      }
    }
  }
};

export const RATING_COLORS = {
  0: 'bg-rose-500 border-rose-600',
  1: 'bg-amber-500 border-amber-600',
  2: 'bg-sky-500 border-sky-600',
  3: 'bg-emerald-500 border-emerald-600'
};

export const RATING_LABELS = {
  0: 'Niveau 0 : Ne maîtrise pas du tout',
  1: 'Niveau 1 : Débutant (sous contrôle)',
  2: 'Niveau 2 : Autonome sur la tâche',
  3: 'Niveau 3 : Expert (peut former)'
};
