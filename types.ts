
export type RatingValue = 0 | 1 | 2 | 3;

export interface Sheet {
  id: string;
  service: string;
  employees: string[];
  tasks: string[];
}

export interface Department {
  id: string;
  name: string;
  sheetsData: Record<string, Sheet>;
}

// ratings[deptId][sheetId][empIdx][taskIdx]
export type RatingsData = Record<string, Record<string, Record<number, Record<number, RatingValue>>>>;

export interface AppState {
  departments: Record<string, Department>;
  ratings: RatingsData;
  version: number;
}

export interface Statistics {
  individualCompetence: Record<number, number>;
  globalCompetence: number;
  masteredTasks: Record<number, number>;
  levelCounts: Record<RatingValue, number>;
}
