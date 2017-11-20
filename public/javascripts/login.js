'use strict';

function onSubmitForm(event) {
  event.preventDefault();
  $('#request-info-alert').css('display', 'block');
  $.ajax({
    url: '/users',
    method: 'POST',
    data: {
      username: $('#username-field').val()
    },
    dataType: 'json',
    success: function(data, textStatus, jqXHR) {
      $('#request-info-alert').css('display', 'none');
      if (data.message === 'success') {
        window.location.replace('/pages/chat');
      } else {
        $('#username-field').addClass('is-invalid');
      }
    },
    error: function(jqXHR, textStatus, errorThrown) {
      $('#request-info-alert').css('display', 'none');
      $('#request-error-alert').html('<strong>Request error</strong>' +
        '<br>Message: ' + textStatus +
        '<br>Status: ' + jqXHR.status);
      $('#request-error-alert').css('display', 'block');
    }
  });
}

$(document).ready(function() {
  $('form').on('submit', function(event) {
    onSubmitForm(event);
  });
});