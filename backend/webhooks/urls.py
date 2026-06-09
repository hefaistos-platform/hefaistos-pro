from django.urls import path

from webhooks import coretide_handler

urlpatterns = [
    path('coretide/', coretide_handler.coretide_webhook, name='coretide_webhook'),
]
