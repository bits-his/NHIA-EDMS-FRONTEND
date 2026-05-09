export interface NhiaZone {
  code: string;
  name: string;
}

export interface NhiaStateOffice {
  id: number;
  name: string;
  zoneCode: string;
}

export interface NhiaDepartment {
  id: number;
  name: string;
}

export interface NhiaUnit {
  id: number;
  name: string;
  departmentId: number;
}

export interface OrgScopeReferenceResponse {
  zones: NhiaZone[];
  stateOffices: NhiaStateOffice[];
  departments: NhiaDepartment[];
  units: NhiaUnit[];
}
