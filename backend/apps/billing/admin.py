from django.contrib import admin
from .models import MonthlyBill, HouseExpense

admin.site.register(MonthlyBill)
admin.site.register(HouseExpense)