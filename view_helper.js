// ---- these are helper functions that let you more easily create useful elements. ----
// ---- Most functions have a required "id_prefix" parameter: you need to specify unique ids that will be used in the HTML,
// ---- so that we can tell from the logs what was actually clicked on.

// --- helper functions for connecting things with events ---

// define an observer which will call the passed on_attr_change function when the watched_attribute of watched_elem_selector
// (more precisely, the first element that matches watched_elem_selector; will not work as intended if the selector selects more than one thing.)
function define_attribute_observer(
  watched_elem_selector,
  watched_attribute,
  on_attr_change = function (new_value) {}
) {
  // set up the observer:
  let attribute_observer = new MutationObserver(function (
    mutationsList,
    observer
  ) {
    for (let mutation of mutationsList) {
      if (mutation.type === 'attributes') {
        if (mutation.attributeName === watched_attribute) {
          // call the function for processing of the attribute change:
          on_attr_change(watched_elem_selector.attr(watched_attribute));
        }
      }
    }
  });
  let watched_element = watched_elem_selector.get(0); // get the DOM element associated with the selector
  attribute_observer.observe(watched_element, { attributes: true });
}

// --- Helper functions to create transient elements and data structures.
// --- These elements will be created and destroyed as needed (often when the data being displayed changes).

// Make an element for a user - this element would usually go into a selectable list of users.
// The element automatically creates an icon which varies based on whether it's a singular user or a group,
// and also adds any attributes you pass along
function make_user_elem(id_prefix, uname, user_attributes = null) {
  user_elem =
    $(`<div class="ui-widget-content" id="${id_prefix}_${uname}" name="${uname}">
        <span id="${id_prefix}_${uname}_icon" class="oi ${
      is_user(all_users[uname]) ? 'oi-person' : 'oi-people'
    }"/> 
        <span id="${id_prefix}_${uname}_text">${uname} </span>
    </div>`);

  if (user_attributes) {
    // if we need to add the user's attributes: go through the properties for that user and add each as an attribute to user_elem.
    for (uprop in user_attributes) {
      user_elem.attr(uprop, user_attributes[uprop]);
    }
  }

  return user_elem;
}

// make a list of users, suitable for inserting into a select list, given a map of user name to some arbitrary info.
// optionally, adds all the properties listed for a given user as attributes for that user's element.
function make_user_list(id_prefix, usermap, add_attributes = false) {
  let u_elements = [];
  for (uname in usermap) {
    // make user element; if add_attributes is true, pass along usermap[uname] for attribute creation.
    user_elem = make_user_elem(
      id_prefix,
      uname,
      add_attributes ? usermap[uname] : null
    );
    u_elements.push(user_elem);
  }
  return u_elements;
}

// --- helper functions to define various semi-permanent elements.
// --- Only call these once for each new dialog/selection/item etc. you are defining! (NOT each time you want to open/close/hide a dialog)

// Define a new type of dialog.
//
// This is essentially a wrapper for a jquery-ui dialog (https://jqueryui.com/dialog/) with some defaults.
// So you can pass in any options available for the dialog widget, and then use the returned value as you would a dialog.
//
// Store the return value in a variable, say new_dialog; then open/close the dialog as needed using:
// new_dialog.dialog('open')
// new_dialog.dialog('close')
//
// - id_orefux is any unique id prefix, as usual
// - title is a string which will go in the title area of the dialog box
// - options is a set of jquery-ui options
// - returns the dialog jquery object
function define_new_dialog(id_prefix, title = '', options = {}) {
  let default_options = {
    appendTo: '#html-loc',
    autoOpen: false,
    modal: true,
    position: { my: 'top', at: 'top', of: $('#html-loc') },
  };

  // add default options - do not override ones that are already specified.
  for (let d_o in default_options) {
    if (!(d_o in options)) {
      options[d_o] = default_options[d_o];
    }
  }

  let dialog = $(`<div id="${id_prefix}" title="${title}"></div>`).dialog(
    options
  );

  return dialog;
}

// Define a generic list which allows you to select one of the items, and propagates that item's 'name' attribute to its own 'selected_item' attribute.
// Note: each selectable item in the list is expted to have a 'name' attribute.
// creates and returns a custom jquery-ui selectable (https://jqueryui.com/selectable/).
// Optionally, provide a custom callback function for what to update when a new selection is made.
// This callback function will be called with 3 arguments:
//    the string from the 'name' attribute of the selected item (probably the only thing you need);
//    the selection event;
//    and the actual HTML element of the selected item
function define_single_select_list(
  id_prefix,
  on_selection_change = function (selected_item_name, e, ui) {}
) {
  let select_list = $(
    `<div id="${id_prefix}" style="overflow-y:scroll"></div>`
  ).selectable({
    selected: function (e, ui) {
      // Unselect any previously selected (normally, selectable allows multiple selections)
      $(ui.selected)
        .addClass('ui-selected')
        .siblings()
        .removeClass('ui-selected');

      // store info about what item was selected:
      selected_item_name = $(ui.selected).attr('name');
      $(this).attr('selected_item', selected_item_name);

      on_selection_change(selected_item_name, e, ui);

      emitter.dispatchEvent(
        new CustomEvent('userEvent', {
          detail: new ClickEntry(
            ActionEnum.CLICK,
            e.clientX + window.pageXOffset,
            e.clientY + window.pageYOffset,
            `${$(this).attr('id')} selected: ${selected_item_name}`,
            new Date().getTime()
          ),
        })
      );
    },
  });

  select_list.unselect = function () {
    select_list.find('.ui-selectee').removeClass('ui-selected');
    on_selection_change('', null, null);
  };

  return select_list;
}

// Function to create a user selection dropdown
function createUserSelectDropdown(id_prefix, users, onChangeCallback) {
  // Create the select element for the dropdown
  let selectDropdown = $(
    `<select id="${id_prefix}_userSelectDropdown" class="user-select-dropdown"></select>`
  );

  // Populate the dropdown with options for each user
  let firstUser = null;
  Object.keys(users).forEach((uname, index) => {
    selectDropdown.append(`<option value="${uname}">${uname}</option>`);
    if (index === 0) {
      firstUser = uname;
    }
  });

  // Bind the change event to handle user selection
  selectDropdown.change(function () {
    let selectedUser = $(this).val();
    onChangeCallback(selectedUser);
  });

  // Set the initial selection to the first user
  if (firstUser !== null) {
    selectDropdown.val(firstUser);
  }

  return selectDropdown;
}

// define an element which will display effective permissions for a given file and user
// It expects the file path to be stored in its *filepath* attribute,
// and the user name to be stored in its *username* attribute
// when either changes, the panel attempts to recalculate the effective permissions.
// - id_prefix is a (required) unique string which will be prepended to all the generated elements.
// - add_info_col is a boolean for whether you want a third column with "info" buttons (which do nothing by default)
// - returns the jquery object for the effective permissions panel, ready to be attached/appended anywhere you want it.
function define_new_effective_permissions(
  id_prefix,
  add_info_col = false,
  which_permissions = null
) {
  // Set up the table:
  let effective_container = $(
    `<div id="${id_prefix}" class="ui-widget-content" style="overflow-y:scroll"></div>`
  );

  // If no subset of permissions is passed in, use all of them.
  if (which_permissions === null) {
    which_permissions = Object.values(permissions);
  }
  // add a row for each permission:
  for (let p of which_permissions) {
    let p_id = p.replace(/[ \/]/g, '_'); //get jquery-readable id
    let row = $(`
        <tr id="${id_prefix}_row_${p_id}" permission_name="${p}" permission_id="${p_id}">
            <td id="${id_prefix}_checkcell_${p_id}" class="effectivecheckcell" width="16px"></td>
            <td id="${id_prefix}_name_${p_id}" class="effective_perm_name">${p}</td>
        </tr>
        `);
    // If we want to add an additional info column (which does nothing by default)
    if (add_info_col) {
      row.append(`
            <td id="${id_prefix}_${p_id}_info_cell" width="32px" style="text-align:right">
                <span id="${id_prefix}_${p_id}_info_icon" class="fa fa-info-circle perm_info" permission_name="${p}" setting_container_id="${id_prefix}"/>
            </td>`);
    }
    effective_container.append(row);
  }

  // Define how to update contents on attribute change:
  let update_effective_contents = function () {
    // get current settings:
    let username = effective_container.attr('username');
    let filepath = effective_container.attr('filepath');
    // if both properties are set correctly:
    if (
      username &&
      username.length > 0 &&
      username in all_users &&
      filepath &&
      filepath.length > 0 &&
      filepath in path_to_file
    ) {
      //clear out the checkboxes:
      effective_container.find(`.effectivecheckcell`).empty();

      // Set checkboxes correctly for given file and user:
      for (let p of which_permissions) {
        let p_id = p.replace(/[ \/]/g, '_'); //get jquery-readable id
        // if the actual model would allow an action with permission
        if (allow_user_action(path_to_file[filepath], all_users[username], p)) {
          // This action is allowed. Find the checkbox cell and put a checkbox there.
          let this_checkcell = effective_container.find(
            `#${id_prefix}_checkcell_${p_id}`
          );
          this_checkcell.append(
            `<span id="${id_prefix}_checkbox_${p_id}" class="oi oi-check"/>`
          );
        }
      }
    }
  };

  // call update_effective_contents when either username or filepath changes:
  define_attribute_observer(
    effective_container,
    'username',
    update_effective_contents
  );
  define_attribute_observer(
    effective_container,
    'filepath',
    update_effective_contents
  );

  return effective_container;
}

// define a dictionary with detailed information for each permission
const permissionDetails = {
  Read: 'Allows reading of the file contents and viewing file properties.',
  Write: 'Allows writing to a file, changing file contents.',
  Make_Changes: 'Includes Write permissions and Delete Permissions.',
  Full_Access:
    'Provides full access, including changing permissions and file ownership.',
  Delete: 'Allows the ability to delete files.',
};

//********************************************************************************
// show tooltip
function showTooltip(event, permissionName) {
  let tooltip = document.getElementById('tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.setAttribute('id', 'tooltip');
    document.body.appendChild(tooltip);
  }
  tooltip.textContent =
    permissionDetails[permissionName] || 'No detailed information available.';
  tooltip.style.display = 'block';
  tooltip.style.left = event.pageX + 15 + 'px';
  tooltip.style.top = event.pageY + 15 + 'px';
  tooltip.style.position = 'absolute';
  tooltip.style.border = '1px solid #ccc';
  tooltip.style.backgroundColor = 'lightyellow';
  tooltip.style.padding = '5px';
  tooltip.style.zIndex = 1000;
}
// hide tooltip
function hideTooltip() {
  const tooltip = document.getElementById('tooltip');
  if (tooltip) {
    tooltip.style.display = 'none';
  }
}
//********************************************************************************

// Display Grouped Permissions Info
function displayPermissionInfo(permissionGroup) {
  // Your logic to display permission info, like opening a modal with the details about the permission group
  // console.log(`Display information about the ${permissionGroup} permission.`);
  // Replace this console.log with your actual implementation
  let infoText =
    permissionDetails[permissionGroup] || 'No detailed information available.';

  // Define the dialog content
  let dialogContent = `
      <div id="permission-info-dialog" title="Permission Information">
          <p>${infoText}</p>
      </div>
  `;

  // Append the dialog content to the body if it doesn't already exist to prevent duplicates
  if ($('#permission-info-dialog').length === 0) {
    $('body').append(dialogContent);
  } else {
    // Update the dialog content for the current permission group
    $('#permission-info-dialog p').text(infoText);
  }

  // Initialize the dialog
  $('#permission-info-dialog').dialog({
    modal: true,
    width: 'auto', // Adjust width based on content
    buttons: {
      Ok: function () {
        $(this).dialog('close');
      },
    },
    close: function () {
      // Remove the dialog from the DOM after closing it to prevent duplicates
      $(this).dialog('destroy').remove();
    },
  });
}

// define an element which will display *grouped* permissions for a given file and user, and allow for changing them by checking/unchecking the checkboxes.
function define_grouped_permission_checkboxes(id_prefix, which_groups = null) {
  // Set up table and header:
  let group_table = $(`
  <table id="${id_prefix}" class="ui-widget-content" width="100%">
    <tr id="${id_prefix}_header">
      <th id="${id_prefix}_header_p" width="50%">Permissions for <span id="${id_prefix}_header_username"></span></th>
      <th id="${id_prefix}_header_info">Info</th>
      <th id="${id_prefix}_header_allow">Allow</th>
      <th id="${id_prefix}_header_deny">Deny</th>
    </tr>
  </table>
  `);

  if (which_groups === null) {
    which_groups = perm_groupnames;
  }

  // Start with a white row:
  let row_color = 'rgb(240,248,255)';

  // For each permissions group, create a row:
  for (let i = 0; i < which_groups.length; i++) {
    const g = which_groups[i];
    let row =
      $(`<tr id="${id_prefix}_row_${g}" style="background-color: ${row_color};">
      <td id="${id_prefix}_${g}_name">${g}</td>
    </tr>`);
    let infoButtonCell = $(`
      <td id="${id_prefix}_${g}_info_cell" style="text-align:center">
        <span id="${id_prefix}_${g}_info_icon" class="fa fa-info-circle perm_info" permission_name="${g}" setting_container_id="${id_prefix}" onclick="displayPermissionInfo('${g}')"></span>
      </td>`);
    row.append(infoButtonCell);

    //********************************************************************************
    infoButtonCell.find(`#${id_prefix}_${g}_info_icon`).hover(
      function (event) {
        // Mouse over
        showTooltip(event, g);
      },
      function () {
        // Mouse out
        hideTooltip();
      }
    );
    //********************************************************************************

    for (let ace_type of ['allow', 'deny']) {
      row.append(`
        <td id="${id_prefix}_${g}_${ace_type}_cell" style="text-align:center; vertical-align:middle;">
          <input type="checkbox" id="${id_prefix}_${g}_${ace_type}_checkbox" ptype="${ace_type}" class="groupcheckbox" group="${g}"></input>
        </td>
      `);
    }
    group_table.append(row);

    // Toggle the row color for the next row:
    row_color =
      row_color === 'rgb(255, 255, 255)'
        ? 'rgb(240,248,255)'
        : 'rgb(255, 255, 255)';
  }

  group_table.find('.groupcheckbox').prop('disabled', true); // disable all checkboxes to start

  // Update checkboxes when either user or file changes:
  let update_group_checkboxes = function () {
    // get current settings:
    let username = group_table.attr('username');
    let filepath = group_table.attr('filepath');
    // if both properties are set correctly:
    if (
      username &&
      username.length > 0 &&
      username in all_users &&
      filepath &&
      filepath.length > 0 &&
      filepath in path_to_file
    ) {
      // clear previous checkbox state:
      group_table.find('.groupcheckbox').prop('disabled', false);
      group_table.find('.groupcheckbox').prop('checked', false);
      group_table
        .find('.groupcheckbox[group="Special_permissions"]')
        .prop('disabled', true); // special_permissions is always disabled

      // change name on table:
      $(`#${id_prefix}_header_username`).text(username);

      // get new grouped permissions:
      let grouped_perms = get_grouped_permissions(
        path_to_file[filepath],
        username
      );

      for (ace_type in grouped_perms) {
        // 'allow' and 'deny'
        for (allowed_group in grouped_perms[ace_type]) {
          let checkbox = group_table.find(
            `#${id_prefix}_${allowed_group}_${ace_type}_checkbox`
          );
          checkbox.prop('checked', true);
          if (grouped_perms[ace_type][allowed_group].inherited) {
            // can't uncheck inherited permissions.
            checkbox.prop('disabled', true);
          }
        }
      }
    } else {
      // can't get permissions for this username/filepath - reset everything into a blank state
      group_table.find('.groupcheckbox').prop('disabled', true);
      group_table.find('.groupcheckbox').prop('checked', false);
      $(`#${id_prefix}_header_username`).text('');
    }
  };
  define_attribute_observer(group_table, 'username', update_group_checkboxes);
  define_attribute_observer(group_table, 'filepath', update_group_checkboxes);

  //Update permissions when checkbox is clicked:
  group_table.find('.groupcheckbox').change(function () {
    toggle_permission_group(
      group_table.attr('filepath'),
      group_table.attr('username'),
      $(this).attr('group'),
      $(this).attr('ptype'),
      $(this).prop('checked')
    );
    update_group_checkboxes(); // reload checkboxes
  });

  return group_table;
}

// define an element which will display *individual* permissions for a given file and user, and allow for changing them by checking/unchecking the checkboxes.
function define_permission_checkboxes(id_prefix, which_permissions = null) {
  // Set up table and header:
  let perm_table = $(`
    <table id="${id_prefix}" class="ui-widget-content" width="100%">
        <tr id="${id_prefix}_header">
            <th id="${id_prefix}_header_p" width="99%">Permissions for <span id="${id_prefix}_header_username"></span>
            </th>
            <th id="${id_prefix}_header_allow">Allow</th>
            <th id="${id_prefix}_header_deny">Deny</th>
        </tr>
    </table>
    `);

  // If no subset of permissions is passed in, use all of them.
  if (which_permissions === null) {
    which_permissions = Object.values(permissions);
  }
  // For each type of permission, create a row:
  for (let p of which_permissions) {
    let p_id = p.replace(/[ \/]/g, '_');
    let row = $(`<tr id="${id_prefix}_row_${p_id}">
            <td id="${id_prefix}_${p_id}_name">${p}</td>
        </tr>`);
    // Add allow and deny checkboxes:
    for (let ace_type of ['allow', 'deny']) {
      row.append(`<td id="${id_prefix}_${p_id}_${ace_type}_cell">
                <input type="checkbox" id="${id_prefix}_${p_id}_${ace_type}_checkbox" ptype="${ace_type}" class="perm_checkbox" permission="${p}" ></input>
            </td>`);
    }

    perm_table.append(row);
  }

  perm_table.find('.perm_checkbox').prop('disabled', true); // disable all checkboxes to start

  let update_perm_table = function () {
    // get current settings:
    let username = perm_table.attr('username');
    let filepath = perm_table.attr('filepath');
    // if both properties are set correctly:
    if (
      username &&
      username.length > 0 &&
      username in all_users &&
      filepath &&
      filepath.length > 0 &&
      filepath in path_to_file
    ) {
      // clear previous checkbox state:
      perm_table.find('.perm_checkbox').prop('disabled', false);
      perm_table.find('.perm_checkbox').prop('checked', false);

      //change name on table:
      $(`#${id_prefix}_header_username`).text(username);

      // Get permissions:
      let all_perms = get_total_permissions(path_to_file[filepath], username);
      for (ace_type in all_perms) {
        // 'allow' and 'deny'
        for (allowed_perm in all_perms[ace_type]) {
          let p_id = allowed_perm.replace(/[ \/]/g, '_');
          let checkbox = perm_table.find(
            `#${id_prefix}_${p_id}_${ace_type}_checkbox`
          );
          checkbox.prop('checked', true);
          if (all_perms[ace_type][allowed_perm].inherited) {
            // can't uncheck inherited permissions.
            checkbox.prop('disabled', true);
          }
        }
      }
    } else {
      // can't get permissions for this username/filepath - reset everything into a blank state
      perm_table.find('.perm_checkbox').prop('disabled', true);
      perm_table.find('.perm_checkbox').prop('checked', false);
      $(`#${id_prefix}_header_username`).text('');
    }
  };

  define_attribute_observer(perm_table, 'username', update_perm_table);
  define_attribute_observer(perm_table, 'filepath', update_perm_table);

  //Update permissions when checkbox is clicked:
  perm_table.find('.perm_checkbox').change(function () {
    console.log(
      perm_table.attr('filepath'),
      perm_table.attr('username'),
      $(this).attr('permission'),
      $(this).attr('ptype'),
      $(this).prop('checked')
    );
    toggle_permission(
      perm_table.attr('filepath'),
      perm_table.attr('username'),
      $(this).attr('permission'),
      $(this).attr('ptype'),
      $(this).prop('checked')
    );
    update_perm_table(); // reload checkboxes
  });

  return perm_table;
}

// Define a list of permission groups for a given file, for all users
function define_file_permission_groups_list(id_prefix) {
  let perm_list = $(`
        <table id="${id_prefix}" class="ui-widget-content" width="100%">
            <tr id="${id_prefix}_header">
                <th id="${id_prefix}_header_type">Type</th>
                <th id="${id_prefix}_header_name">Name</th>
                <th id="${id_prefix}_header_permission">Permission</th>
                <th id="${id_prefix}_header_inherited">Inherited from</th>
            </tr>
        </table>
    `);

  let update_perm_list = function () {
    $(`#${id_prefix} tr:gt(0)`).remove(); // remove all old permission stuff - all but the first (title) row of the table.

    let filepath = perm_list.attr('filepath');
    console.log(filepath);

    if (filepath && filepath.length > 0 && filepath in path_to_file) {
      console.log('filepath');

      let file_obj = path_to_file[filepath];
      let users = get_file_users(file_obj);
      for (let u in users) {
        let grouped_perms = get_grouped_permissions(file_obj, u);
        for (let ace_type in grouped_perms) {
          for (let perm in grouped_perms[ace_type]) {
            perm_list.append(`<tr id="${id_prefix}_${
              file_obj.filename
            }__${u}_${ace_type}_${perm}">
                            <td id="${id_prefix}_${
              file_obj.filename
            }__${u}_${ace_type}_${perm}_type">${ace_type}</td>
                            <td id="${id_prefix}_${
              file_obj.filename
            }__${u}_${ace_type}_${perm}_name">${u}</td>
                            <td id="${id_prefix}_${
              file_obj.filename
            }__${u}_${ace_type}_${perm}_permission">${perm}</td>
                            <td id="${id_prefix}_${
              file_obj.filename
            }__${u}_${ace_type}_${perm}_type">${
              grouped_perms[ace_type][perm].inherited
                ? 'Parent Object'
                : '(not inherited)'
            }</td>
                        </tr>`);
          }
        }
      }
    }
  };

  define_attribute_observer(perm_list, 'filepath', update_perm_list);

  return perm_list;
}

// -- a general-purpose User Select dialog which can be opened when we need to select a user. --

// Make a selectable list which will store all of the users, and automatically keep track of which one is selected.
all_users_selectlist = define_single_select_list('user_select_list');

// Make the elements which reperesent all users, and add them to the selectable
all_user_elements = make_user_list('user_select', all_users);
all_users_selectlist.append(all_user_elements);

// Make the dialog:
user_select_dialog = define_new_dialog('user_select_dialog2', 'Select User', {
  buttons: {
    Cancel: {
      text: 'Cancel',
      id: 'user_select_cancel_button',
      click: function () {
        $(this).dialog('close');
      },
    },
    OK: {
      text: 'OK',
      id: 'user_select_ok_button',
      click: function () {
        // When "OK" is clicked, we want to populate some other element with the selected user name
        //(to pass along the selection information to whoever opened this dialog)
        let to_populate_id = $(this).attr('to_populate'); // which field do we need to populate?
        // console.log("populate id " + to_populate_id);
        let selected_value = all_users_selectlist.attr('selected_item'); // what is the user name that was selected?
        // console.log("selected item " + selected_value);
        $(`#${to_populate_id}`).attr('selected_user', selected_value); // populate the element with the id
        $(this).dialog('close');
      },
    },
  },
});

// add stuff to the dialog:
user_select_dialog.append(all_users_selectlist);

// Call this function whenever you need a user select dialog; it will automatically populate the 'selected_user' attribute of the element with id to_populate_id
function open_user_select_dialog(to_populate_id) {
  // TODO: reset selected user?..

  user_select_dialog.attr('to_populate', to_populate_id);
  user_select_dialog.dialog('open');
}

// define a new user-select field which opens up a user-select dialog and stores the result in its own selected_user attribute.
// The resulting jquery element contains a field and a button. The field's text also gets populated with the selected user.
// - id_prefix is the required id prefix that will be attached to all element ids.
// - select_button_text is the text that will go on the button
// - on_user_change is an additional function you can pass in, which will be called each time a user is selected.
function define_new_user_select_field(
  id_prefix,
  select_button_text,
  on_user_change = function (selected_user) {}
) {
  // Make the element:
  let sel_section =
    $(`<div id="${id_prefix}_line" class="button-align-right section">
            <span id="${id_prefix}_field" class="ui-widget-content" style="width: 80%;display: inline-block;">&nbsp</span>
            <button id="${id_prefix}_button" class="ui-button ui-widget ui-corner-all">${select_button_text}</button>
        </div>`);

  // Open user select on button click:
  sel_section.find(`#${id_prefix}_button`).click(function () {
    open_user_select_dialog(`${id_prefix}_field`);
  });

  // Set up an observer to watch the attribute change and change the field
  let field_selector = sel_section.find(`#${id_prefix}_field`);
  define_attribute_observer(
    field_selector,
    'selected_user',
    function (new_username) {
      field_selector.text(new_username);
      // call the function for additional processing of user change:
      on_user_change(new_username);
    }
  );

  return sel_section;
}

//---- misc. ----

// Get a (very simple) text representation of a permissions explanation
function get_explanation_text(explanation) {
  return `
    Action allowed?: ${explanation.is_allowed}; 
    Because of
    permission set for file: ${
      explanation.file_responsible
        ? get_full_path(explanation.file_responsible)
        : 'N/A'
    }
    and for user: ${
      explanation.ace_responsible
        ? get_user_name(explanation.ace_responsible.who)
        : 'N/A'
    }
    ${explanation.text_explanation ? `(${explanation.text_explanation})` : ''}
    `;
}

//---- some universal HTML set-up so you don't have to do it in each wrapper.html ----
$('#filestructure').css({
  display: 'inline-block',
  width: '49%',
  'vertical-align': 'top',
});
$('#filestructure').after(
  '<div id="sidepanel" style="display:inline-block;width:49%"></div>'
);
