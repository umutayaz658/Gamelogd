export interface RegisterFormData {
  username: string;
  realName: string;
  email: string;
  password: string;
  confirmPassword: string;
  phoneNumber: string;
  roles: string[];
  gender: string;
  birthDate: string;
  interests: string[];
  platforms: string[];
}

export const initialRegisterFormData: RegisterFormData = {
  username: '',
  realName: '',
  email: '',
  password: '',
  confirmPassword: '',
  phoneNumber: '',
  roles: [],
  gender: '',
  birthDate: '',
  interests: [],
  platforms: [],
};
