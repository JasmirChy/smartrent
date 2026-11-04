from django.contrib import admin
from .models import User, EmailOTP

admin.site.register(User)
admin.site.register(EmailOTP)