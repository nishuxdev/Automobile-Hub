"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.views.generic import TemplateView
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('auth/', include('apps.users.urls')),
    path('', TemplateView.as_view(template_name='index.html'), name='home'),
    path('login/', TemplateView.as_view(template_name='login.html'), name='login'),
    path('signup/', TemplateView.as_view(template_name='signup.html'), name='signup'),
    path('verify-otp/', TemplateView.as_view(template_name='verify_otp.html'), name='verify_otp_ui'),
    path('customer/dashboard/', TemplateView.as_view(template_name='customer_dashboard.html'), name='customer_dashboard'),
    path('mechanic/dashboard/', TemplateView.as_view(template_name='mechanic_dashboard.html'), name='mechanic_dashboard'),
    path('mechanic/onboarding/', TemplateView.as_view(template_name='mechanic_onboarding.html'), name='mechanic_onboarding'),
    path('dashboard/admin/', TemplateView.as_view(template_name='admin_dashboard.html'), name='admin_dashboard'),
    path('chatbot/', TemplateView.as_view(template_name='chatbot.html'), name='chatbot'),
    path('chatbot-api/', include('apps.chatbot.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)