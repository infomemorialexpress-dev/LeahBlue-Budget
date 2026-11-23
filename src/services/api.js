function resolveApiBaseUrl(rawValue) {
  const cleaned = (rawValue || '').trim().replace(/\/+$/, '');
  if (!cleaned) return '/api';
  if (/^https?:\/\//i.test(cleaned) && !cleaned.endsWith('/api')) {
    return `${cleaned}/api`;
  }
  return cleaned;
}

export const API_BASE_URL = resolveApiBaseUrl(import.meta.env.VITE_API_URL);

export const TOKEN_STORAGE_KEY = 'leahblue_token';
export const USER_STORAGE_KEY = 'leahblue_user';

export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  const url = `${API_BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: response.statusText }));
      const error = new Error(errorBody.message || 'API request failed');
      error.status = response.status;
      error.response = {
        status: response.status,
        statusText: response.statusText,
        url,
        data: errorBody,
      };
      console.error('API Error:', error.message, error.response);
      throw error;
    }

    return await response.json();
  } catch (error) {
    if (!error.response) {
      error.response = { url, networkError: true };
      console.error('API Error:', error.message, error.response);
    }
    throw error;
  }
}

export function login(credentials) {
  return apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  });
}

export function register(payload) {
  return apiRequest('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function forgotPassword(email) {
  return apiRequest('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function resetPassword(token, password) {
  return apiRequest(`/auth/reset-password/${encodeURIComponent(token)}`, {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
}

export function createIncome(payload) {
  return apiRequest('/incomes', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getIncome() {
  return apiRequest('/incomes');
}

export function updateIncome(id, payload) {
  return apiRequest(`/incomes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function deleteIncome(id) {
  return apiRequest(`/incomes/${id}`, {
    method: 'DELETE',
  });
}

export function createExpense(payload) {
  return apiRequest('/expenses', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getExpenses() {
  return apiRequest('/expenses');
}

export function deleteExpense(id) {
  return apiRequest(`/expenses/${id}`, {
    method: 'DELETE',
  });
}

export function getDashboardSummary() {
  return apiRequest('/dashboard/summary');
}

export function getWeeklyCheckIn() {
  return apiRequest('/dashboard/weekly-checkin');
}

export function getBills() {
  return apiRequest('/bills');
}

export function createBill(payload) {
  return apiRequest('/bills', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateBill(id, payload) {
  return apiRequest(`/bills/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function deleteBill(id) {
  return apiRequest(`/bills/${id}`, {
    method: 'DELETE',
  });
}

export function markBillPaid(id, isPaid = true) {
  return apiRequest(`/bills/${id}/pay`, {
    method: 'PATCH',
    body: JSON.stringify({ isPaid }),
  });
}

export function getGoals() {
  return apiRequest('/goals');
}

export function createGoal(payload) {
  return apiRequest('/goals', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateGoal(id, payload) {
  return apiRequest(`/goals/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteGoal(id) {
  return apiRequest(`/goals/${id}`, {
    method: 'DELETE',
  });
}

const DEFAULT_CATEGORY_BUDGETS = [
  { category: 'Groceries', targetAmount: 400 },
  { category: 'Gas', targetAmount: 100 },
  { category: 'Kids', targetAmount: 150 },
  { category: 'Household', targetAmount: 150 },
  { category: 'Dining Out', targetAmount: 100 },
  { category: 'Other', targetAmount: 50 },
];

export async function getCategoryBudgets(userKey = 'default') {
  try {
    const data = await apiRequest('/category-budgets');
    if (Array.isArray(data) && data.length > 0) {
      return data.map((b) => ({
        id: b._id || b.id,
        category: b.name || b.category,
        targetAmount: Number(b.monthlyTarget ?? b.targetAmount ?? 0),
      }));
    }

    // Auto-migrate from localStorage if backend has no budgets yet
    const raw = localStorage.getItem(`leahblue_category_budgets_${userKey}`);
    const localBudgets = raw ? JSON.parse(raw) : DEFAULT_CATEGORY_BUDGETS;
    const toSave =
      Array.isArray(localBudgets) && localBudgets.length > 0
        ? localBudgets
        : DEFAULT_CATEGORY_BUDGETS;
    const synced = await syncCategoryBudgets(toSave);
    return Array.isArray(synced) && synced.length > 0
      ? synced.map((b) => ({
          id: b._id || b.id,
          category: b.name || b.category,
          targetAmount: Number(b.monthlyTarget ?? b.targetAmount ?? 0),
        }))
      : toSave;
  } catch {
    const raw = localStorage.getItem(`leahblue_category_budgets_${userKey}`);
    if (!raw) return DEFAULT_CATEGORY_BUDGETS;
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_CATEGORY_BUDGETS;
    } catch {
      return DEFAULT_CATEGORY_BUDGETS;
    }
  }
}

export async function saveCategoryBudgets(userKey = 'default', budgets = []) {
  try {
    localStorage.setItem(`leahblue_category_budgets_${userKey}`, JSON.stringify(budgets));
    const synced = await syncCategoryBudgets(budgets);
    return Array.isArray(synced) && synced.length > 0
      ? synced.map((b) => ({
          id: b._id || b.id,
          category: b.name || b.category,
          targetAmount: Number(b.monthlyTarget ?? b.targetAmount ?? 0),
        }))
      : budgets;
  } catch {
    return budgets;
  }
}

export function syncCategoryBudgets(budgets) {
  return apiRequest('/category-budgets', {
    method: 'PUT',
    body: JSON.stringify({ budgets }),
  });
}

export function createCategoryBudget(payload) {
  return apiRequest('/category-budgets', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateCategoryBudget(id, payload) {
  return apiRequest(`/category-budgets/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function deleteCategoryBudget(id) {
  return apiRequest(`/category-budgets/${id}`, {
    method: 'DELETE',
  });
}

export function getPaycheckPlanSuggestion() {
  return apiRequest('/paycheck-plans/suggest');
}

export function getPaycheckPlans() {
  return apiRequest('/paycheck-plans');
}

export function createPaycheckPlan(payload) {
  return apiRequest('/paycheck-plans', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
