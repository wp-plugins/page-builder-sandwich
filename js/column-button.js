(function() {

	var sortableInit = false;
	
	/**
	 * Checks if the content selected is an existing column table.
	 * If it is, get each column content
	 */
	function _pbsandwich_columns_formContent( content, numColumns ) {
		if ( content === '' ) {
			return pbsandwich_column.dummy_content;
		}
		
		var $ = jQuery;
		var contents = [];
		
		var $content = $('<div></div>').html(content);
		if ( $content.find('table.pbsandwich_column').length == 0 ) {
			return pbsandwich_column.dummy_content;
		}
		
		$content.find('table.pbsandwich_column td').each( function( i, e ) {
			if ( i >= numColumns ) {
				contents[ contents.length - 1] += '<p>' + $(e).html() + '</p>';
			} else {
				contents.push( $(e).html() );
			}
		} );
		
		return contents;
	}
	
	
	/**
	 * Forms the table "columns"
	 */
	function _pbsandwich_columns_formTable( columns, content ) {
		var $ = jQuery;
		
		var cols = columns.split('+');
		var table = '<table class="pbsandwich_column" style="width: 100%; height: auto; border: none;" border="0"><tbody class="row"><tr>';
		var columnContents = _pbsandwich_columns_formContent( content, cols.length );
		var columnContent = pbsandwich_column.dummy_content;
		
		$.each( cols, function( i, e ) {
			
			// Get what content we will use
			if ( typeof columnContents === 'object' ) {
				if ( i >= columnContents.length ) {
					columnContent = '&nbsp;';
				} else {
					columnContent = columnContents[ i ]
				}
			} else if ( typeof columnContents === 'string' ) {
				if ( content.trim() !== '' ) {
					if ( i === 0 ) {
						columnContent = content;
					} else {
						columnContent = '&nbsp;';
					}
				}
			}
			
			// Compute our margins
			var fraction = e.split('/');
			var width = parseInt( fraction[0] ) / parseInt( fraction[1] ) * 100;
			var col = parseInt( parseInt( fraction[0] ) / parseInt( fraction[1] ) * 12 );
			
			// the style: width is only used in the backend since the table WON'T allow us to FIX it's width
			table += '<td class="col-sm-' + col + '" style="width: ' + width + '%;"><p>' + columnContent + '</p></td>';
		} );
		
		table += '</tr></tbody></table>';
		
		return table;
	}
	
	
	/**
	 * Forms the column labels for TinyMCE
	 */
	function _pbsandwich_columns_sprintf( format, etc ) {
	    var arg = arguments;
	    var i = 1;
	    return format.replace(/%((%)|s)/g, function (m) { return m[2] || arg[i++] })
	}
	
	
	/**
	 * Destroys all the sortables
	 */
	function preUpdateSortable( editor ) {
		var $ = jQuery;
		try {
			$(editor.getBody()).sortable('destroy');
			$(editor.getBody()).find('.pbsandwich_column td').sortable('destroy');
		} catch (e) { }
	}
	
	
	/**
	 * Cancel sortable
	 */
	function cancelSortable( editor ) {
		var $ = jQuery;
		try {
			$(editor.getBody()).sortable('cancel');
			$(editor.getBody()).find('.pbsandwich_column td').sortable('cancel');
		} catch (e) { }
	}
	
	
	/**
	 * Sortable start handler
	 */
	function sortStartHandler( editor ) {
		var editorBody = jQuery( editor.getBody() );
		editorBody.addClass('pbsandwich_just_dragged');
		_pbsandwich_removeToolbar( editor );
		
		// Views with iframes (e.g. audio & video embeds) get very slow when dragging, hide them
		if ( editorBody.find('.wpview-wrap[data-mce-selected="1"] iframe').length > 0 ) {
			editorBody.find('.wpview-wrap[data-mce-selected="1"] iframe').css('visibility', 'hidden');
		}
	}
	
	
	/**
	 * Sortable end handler
	 */
	function sortEndHandler( editor ) {
		var editorBody = jQuery( editor.getBody() );
		try {
			editorBody.sortable('refresh');
			editorBody.find('.pbsandwich_column td').sortable('refresh');
		} catch (e) { }
		
		editorBody.removeClass('pbsandwich_just_dragged');
		
		// Views with iframes do not refresh after sorting, mceCleanup fixes this (also brings back the visibility)
		if ( editorBody.find('.wpview-wrap[data-mce-selected="1"] iframe').length > 0 ) {
			editorBody.find('.wpview-wrap[data-mce-selected="1"]').removeAttr('data-mce-selected');
			editor.execCommand( 'mceCleanup' );
		}
	}
	
	
	/**
	 * Create sortables
	 */
	function updateSortable( editor ) {
		var $ = jQuery;
		// fixTableParagraphs( editor );
		jQuery(editor.getBody()).sortable({
			scroll: false, 
			connectWith: jQuery(editor.getBody()).find('.pbsandwich_column td'), 
			placeholder: "sortable-placeholder",
			cancel: pbsandwich_column.non_sortable_elements,
			opacity: 0.7,
			forceHelperSize: true, // This is to help dragging
			tolerance: 'pointer',
			stop: function() {
				sortEndHandler( editor );
			},
			update: function() {
				fixTableParagraphs( editor );
			},
			start: function() {
				sortStartHandler( editor );
			}
		});
		$(editor.getBody()).find('.pbsandwich_column td').sortable({ 
			scroll: false, 
			connectWith: jQuery(editor.getBody()).find('.pbsandwich_column td').add(jQuery(editor.getBody())), 
			placeholder: "sortable-placeholder",
			cancel: pbsandwich_column.non_sortable_elements,
			opacity: 0.7,
			forceHelperSize: true, // This is to help dragging
			tolerance: 'pointer',
			stop: function() {
				sortEndHandler( editor );
			},
			update: function() {
				fixTableParagraphs( editor );
			},
			start: function() {
				sortStartHandler( editor );
			}
		});
	}
	
	
	/**
	 * On save/preview, remove sortable. But still allow re-initialization
	 */
	jQuery('body').on('click', '[name="save"], #post-preview', function() { 
		var $ = jQuery;
		try {
			preUpdateSortable( tinyMCE.activeEditor );
			$( tinyMCE.activeEditor.getBody() ).find('[class=""]').removeAttr('class');
			sortableInit = false;
		} catch (e) { }
	});
	
	
	/**
	 * Switching between different editors screw up our stuff.
	 * 1. paragraphs are removed
	 * 2. sortables become unsortable
	 * @see WordPress bug https://core.trac.wordpress.org/ticket/20943
	 */
	jQuery('body').on('click', '.wp-switch-editor', function() {
		
		// 1. paragraphs are removed
		fixTableParagraphs( tinyMCE.activeEditor );
		
		// 2. sortables become unsortable
		preUpdateSortable( tinyMCE.activeEditor );
		updateSortable( tinyMCE.activeEditor );
	});
	
	
	/**
	 * When unselected, single clicking Shortcake / TinyMCE views will somehow start a sortable drag event.
	 * This makes the view hard to release. This function fixes it. 
	 * When the view is clicked (mousedown then mouseup only), it doesn't trigger a sortable drag event
	 * When the view is click dragged for the first time, normal sortable drag event is handled normally.
	 */
	function fixShortcakeDragging( editor ) {
		var $ = jQuery;
		
		// For views with iframes (e.g. video & audio), clicking on the iframe to play a preview
		// won't work with sortable sorting. Our semi work-around is to just deselect the iframe
		// so that it can still be dragged around after moving the mouse around/outside the iframe.
		$(editor.getBody())
		.on('mousemove', '.wpview-wrap[data-mce-selected="1"] .toolbar', function(e) {
			var $ = jQuery;

			var parent = $(this).parents('.wpview-wrap:eq(0)');
			if ( ! parent.is('[data-check-move="1"]') ) {
				return;
			}
			if ( parent.find('iframe').length === 0 ) {
				return;
			}
			
			if ( e.which !== 1 ) {
				try {
					$(editor.getBody()).sortable('disable');
					$(editor.getBody()).find('.pbsandwich_column td').sortable('disable');
				} catch (e) { }

				parent.trigger('mouseup');
	
				try {
					$(editor.getBody()).sortable('enable');
					$(editor.getBody()).find('.pbsandwich_column td').sortable('enable');
				} catch (e) { }
				
			}
		})
		.on('mousemove', function(e) {
			var $ = jQuery;
			
			var iframe = $(this).find('.wpview-wrap[data-mce-selected="1"] iframe');
			if ( iframe.length === 0 ) {
				return;
			}
			
			if ( e.which !== 1 ) {
			
				try {
					$(editor.getBody()).sortable('disable');
					$(editor.getBody()).find('.pbsandwich_column td').sortable('disable');
				} catch (e) { }

				iframe.parents('.wpview-wrap:eq(0)').trigger('mouseup');
	
				try {
					$(editor.getBody()).sortable('enable');
					$(editor.getBody()).find('.pbsandwich_column td').sortable('enable');
				} catch (e) { }
				
			}
		})
		
		.on('mousemove', '.wpview-wrap', function(e) {
			if ( $(this).is('[data-check-move="1"]') ) {
				$(this).removeAttr('data-check-move');
			}
		})
		
		.on('mouseup', '.wpview-wrap', function(e) {
			if ( $(this).is('[data-check-move="1"]') ) {
				$(this).removeAttr('data-check-move');
				$(this).trigger('mousemove').trigger('mouseup');
			}
		})
		
		.on('mousedown', '.wpview-wrap', function(e) {
			$(this).attr('data-check-move', '1');
		});
	}
	
	
	/**
	 * Paragraph tags are being removed inside tables. Fix it
	 * @see WordPress bug https://core.trac.wordpress.org/ticket/20943
	 */
	function fixTableParagraphs( editor ) {
		var $ = jQuery;
		
		$(editor.getBody()).find('.pbsandwich_column td').each(function() {
			
			// @see http://stackoverflow.com/questions/20183324/javascript-wrapping-unwrapped-plain-text
			var elemCount = $(this).contents().length;
			$(this).contents().filter( function() {
			    return this.nodeType === 3;
			} ).each( function() {
			    this.nodeValue = $.trim( this.nodeValue );
				if ( elemCount === 0 || ( this.nodeValue === '' && elemCount === 1 ) ) {
					this.nodeValue = '\u00a0';
				}
			} ).wrap( '<p></p>' );

			// Remove blank paragraphs in columns which have other contents
			if ( $(this).children().length > 1 ) {
				$(this).find('> p').each(function() {
					if ( $(this).html().trim() === '' ) {
						$(this).remove();
					}
				});
			}
			
			// Columns that get emptied should still have a paragraph
			if ( $(this).children().length == 0 ) {
				$(this).append('<p></p>');
			}
			
			// Columns with just a blank paragraph will not be edited unless they have a space
			if ( $(this).children().length == 1 ) {
				var firstChild = $(this).children(':eq(0)');
				if ( firstChild.is('p') && firstChild.text() === '' ) {
					firstChild.text( '\u00a0' );
				}
			}
			
		});
	}
	
	
	/**
	 * Change columns modal action handler. When a change column button is clicked
	 */
	jQuery('body').on('click', '#pbsandwich_column_change_modal button', function() {
		var $ = jQuery;
		
		// Get the column composition
		var columns = $(this).attr('data-columns');
		if ( typeof columns === 'undefined' ) {
			columns = $(this).parents('#pbsandwich_column_change_modal').find('input.custom_column').val();
		}
		
		// The column container will have the attribute data-wp-columnselect
		tinyMCE.activeEditor.selection.select( $(tinyMCE.activeEditor.getBody()).find('[data-wp-columnselect="1"]')[0] );
		
		// Change the column
		preUpdateSortable( tinyMCE.activeEditor );
        tinyMCE.activeEditor.insertContent( _pbsandwich_columns_formTable( columns, tinyMCE.activeEditor.selection.getContent() ) );
		updateSortable( tinyMCE.activeEditor );
		
		// Close our modal window
		tinyMCE.activeEditor.windowManager.getWindows()[0].close();
	});
	
	
	/**
	 * Perform a toolbar action
	 */
	function _pbsandwich_do_action( editor, node, action ) {
		var $ = jQuery;
		
		if ( action === 'remove' ) {
			preUpdateSortable( editor );
			$(editor.getBody()).find('[data-wp-columnselect]').remove();
			updateSortable( editor );
			
		} else if ( action === 'clone' ) {
			preUpdateSortable( editor );
			var newElement = $(editor.getBody()).find('[data-wp-columnselect]').clone();
			newElement.insertAfter( $(editor.getBody()).find('[data-wp-columnselect]') );
			updateSortable( editor );
			
			// Cleanup to make views with iframes display again
			if ( ( newElement.find('.wpview-wrap iframe').length > 0 ) ) {
				editor.execCommand( 'mceCleanup' );
			}
			
		} else if ( action === 'columns' ) {
		    var colModal = editor.windowManager.open( {
		        title: pbsandwich_column.change_column,
				buttons: [{
                    text: pbsandwich_column.cancel,
                    onclick: 'close'
                }],
		        body: [{
					type: 'container',
					html: '<div id="pbsandwich_column_change_modal"><h4>' + pbsandwich_column.preset + '</h4><p class="desc">' + pbsandwich_column.preset_desc + '</p>' +
						'<p class="mce-btn"><button data-columns="1/2+1/2">' + _pbsandwich_columns_sprintf( pbsandwich_column.columns, '2' ) + '</button></p> ' + 
						'<p class="mce-btn"><button data-columns="1/3+1/3+1/3">' + _pbsandwich_columns_sprintf( pbsandwich_column.columns, '3' ) + '</button></p> ' + 
						'<p class="mce-btn"><button data-columns="1/4+1/4+1/4+1/4">' + _pbsandwich_columns_sprintf( pbsandwich_column.columns, '4' ) + '</button></p> ' + 
						'<p class="mce-btn"><button data-columns="1/3+2/3">' + _pbsandwich_columns_sprintf( pbsandwich_column.columns, '1/3 + 2/3' ) + '</button></p> ' + 
						'<p class="mce-btn"><button data-columns="2/3+1/3">' + _pbsandwich_columns_sprintf( pbsandwich_column.columns, '2/3 + 1/3' ) + '</button></p> ' + 
						'<p class="mce-btn"><button data-columns="1/4+2/4+1/4">' + _pbsandwich_columns_sprintf( pbsandwich_column.columns, '1/4 + 2/4 + 1/4' ) + '</button></p> ' + 
						'<hr>' +
						'<h4>' + pbsandwich_column.custom + '</h4><input type="text" class="mce-textbox custom_column" value="1/2+1/2"><p class="mce-btn"><button>' + pbsandwich_column.use_custom + '</button></p><p class="desc">' + pbsandwich_column.modal_description + '<code style="font-family: monospace; background: #eee; padding: 0 .4em; line-height: 1.6em; display: inline-block; border: 1px solid #ddd; border-radius: 4px;">1/2+1/2</code> <code style="font-family: monospace; background: #eee; padding: 0 .4em; line-height: 1.6em; display: inline-block; border: 1px solid #ddd; border-radius: 4px;">1/3+1/3+1/3</code> <code style="font-family: monospace; background: #eee; padding: 0 .4em; line-height: 1.6em; display: inline-block; border: 1px solid #ddd; border-radius: 4px;">1/4+2/4+1/4</code></p></div>'
				}],
		        onsubmit: function( e ) {
					preUpdateSortable( editor );
                    editor.insertContent( _pbsandwich_columns_formTable( e.data.columns, editor.selection.getContent() ) );
					updateSortable( editor );
		        }
		    });

			
		} else if ( action === 'edit' ) {
			// TODO

		}

		_pbsandwich_removeToolbar( editor );
	}
	

	/**
	 * Adds the toolbar
	 * @see http://wordpress.stackexchange.com/questions/74762/hook-for-image-edit-popup
	 */
    function _pbsandwich_addToolbar( editor, node ) {
		var $ = jQuery;
		var rectangle, toolbarHtml, toolbar, left,
		dom = editor.dom;

		_pbsandwich_removeToolbar( editor );
		
		// Don't create the toolbar if the column was just dragged
		if ( $(editor.getBody()).hasClass('pbsandwich_just_dragged') ) {
			return;
		}

		// Only add the toolbar for columns
		if ( $(node).parents('.pbsandwich_column:eq(0)').length === 0 ) {
			return;
		}
		node = $(node).parents('.pbsandwich_column:eq(0)')[0];

		// Remember the column that has the toolbar
		$(editor.getBody()).find( '[data-wp-columnselect]' ).removeAttr( 'data-wp-columnselect' );
		dom.setAttrib( node, 'data-wp-columnselect', 1 );

		// Create the toolbar
		toolbarHtml = 
			// '<div class="dashicons dashicons-edit" data-column-action="edit" data-mce-bogus="1" title="' + pbsandwich_column.edit + '"></div>' +
			'<div class="dashicons dashicons-tagcloud" data-column-action="columns" data-mce-bogus="1" title="' + pbsandwich_column.change_columns + '"></div>' +
			'<div class="dashicons dashicons-images-alt" data-column-action="clone" data-mce-bogus="1" title="' + pbsandwich_column.clone + '"></div>' +
			'<div class="dashicons dashicons-no-alt" data-column-action="remove" data-mce-bogus="1" title="' + pbsandwich_column.delete + '"></div>';

		toolbar = dom.create( 'div', {
			'id': 'wp-column-toolbar',
			'data-mce-bogus': '1',
			'contenteditable': false
		}, toolbarHtml );

		editor.getBody().appendChild( toolbar );
		rectangle = dom.getRect( node );
		dom.setStyles( toolbar, {
			top: rectangle.y,
			left: rectangle.x + rectangle.w / 2
		});
    }
	

	/**
	 * Remove the toolbar
	 * @see http://wordpress.stackexchange.com/questions/74762/hook-for-image-edit-popup
	 */
	function _pbsandwich_removeToolbar( editor ) {
		var toolbar = editor.dom.get( 'wp-column-toolbar' );

		if ( toolbar ) {
			editor.dom.remove( toolbar );
		}
	}
	  
	
	/**
	 * Add the button
	 */
    tinymce.PluginManager.add( 'pbsandwich_column', function( editor, url ) {
		
		
		/**
		 * Sortable / drag and drop initializer
		 */
		editor.on('mousemove', function(e) {
			if ( ! sortableInit ) {
				updateSortable( editor );
				fixShortcakeDragging( editor );
				sortableInit = true;
			}
		} );
		
		
		/**
		 * Paragraph tags are being removed inside tables. Fix it
		 * @see WordPress bug https://core.trac.wordpress.org/ticket/20943
		 */
		editor.on('init', function(e) {
			fixTableParagraphs( editor );
		});
		
		
		/**
		 * Hide the drag handles of tables when our columns are selected
		 */
		editor.on('mousedown', function(e) {
			var $ = jQuery;
			if ( $(e.target).parents('.pbsandwich_column:eq(0)').length > 0 ) {
				$(editor.getBody()).addClass('pbsandwich_column_selected');
			} else {
				$(editor.getBody()).removeClass('pbsandwich_column_selected');
			}
			_pbsandwich_removeToolbar( editor );
		});
		
		
		/**
		 * Show the toolbar
		 */
		editor.on('mouseup', function(e) {
			var $ = jQuery;
			if ( $(e.target).is( '[data-column-action]' ) ) {
				_pbsandwich_do_action( editor, e.target, $(e.target).attr('data-column-action') );
				return;
			}
			_pbsandwich_addToolbar( editor, e.target );
		});
		
		
		/**
		 * Hide the toolbar. We do it this way since when a view is clicked,
		 * the normal mousedown/click handlers are not fired
		 */
		editor.on('init', function(e) {
			var $ = jQuery;
			$( editor.getBody() ).on('mousedown', function(e) {
				
				// Don't remove the toolbar when the toolbar is clicked
				if ( $(e.target).is( '[data-column-action]' ) ) {
					e.stopPropagation();
					return;
				}
			
				_pbsandwich_removeToolbar( editor );
			});
		});
		
		
		/**
		 * Adds a clone button in shortcake/view toolbars.
		 * Add a click handler & clone method for the new clone button.
		 */
		editor.on('init', function(e) {
			var $ = jQuery;
			$( editor.getBody() ).on('mousedown', function(e) {
				
				if ( $(e.target).parents('.wpview-wrap:eq(0)').length > 0 ) {
					if ( $(e.target).parents('.wpview-wrap:eq(0)').find('.clone').length === 0 ) {
						$('<div class="dashicons dashicons-images-alt clone" title="Clone"></div>').insertBefore( $(e.target).parents('.wpview-wrap:eq(0)').find('.toolbar > .dashicons:eq(-1)') );
					}
				}
				
				if ( $(e.target).parents('.wpview-wrap:eq(0)').length > 0 ) {
					if ( $(e.target).is('.dashicons.clone') ) {
						// cancelSortable( editor );
						preUpdateSortable( editor );
						var newElement = $(e.target).parents('.wpview-wrap:eq(0)').clone();
						newElement.insertAfter( $(e.target).parents('.wpview-wrap:eq(0)') ).trigger('click');
						updateSortable( editor );
			
						// Cleanup to make views with iframes display again
						if ( newElement.find('iframe').length > 0 ) {
							editor.execCommand( 'mceCleanup' );
						}
					}
				}
				
			});
		});
		
		
		/**
		 * When creating a column, then creating a shortcake/view inside it, we
		 * get errors: the view cannot be dragged because the sortables aren't updated.
		 * There's currently no event when shortcake adds an element, we can check for it
		 * using this event instead, then refresh our sortables to make the view work
		 * right away.
		 */
		var numShortcakes = -1;
		editor.on('wp-body-class-change change', function(e) {
			var $ = jQuery;
			// At the start, remember the number of shortcakes/views
			if ( numShortcakes === -1 ) {
				numShortcakes = $(editor.getBody()).find('.wpview-wrap').length;
				return;
			}
			// When the number changes, update our sortables
			if ( numShortcakes !== $(editor.getBody()).find('.wpview-wrap').length ) {
				numShortcakes = $(editor.getBody()).find('.wpview-wrap').length;
				preUpdateSortable( editor );
				updateSortable( editor );
			}
		});
		editor.on('init', function(e) {
			var $ = jQuery;
		
			/**
			 * DOMNodeRemoved event can catch view removals
			 */
			$( editor.getBody() ).on('DOMNodeRemoved', function(e) {
				if ( numShortcakes === -1 ) {
					return;
				}
				if ( numShortcakes !== $(editor.getBody()).find('.wpview-wrap').length ) {
					numShortcakes = $(editor.getBody()).find('.wpview-wrap').length;
					preUpdateSortable( editor );
					updateSortable( editor );
				}
			});
		});
		

        editor.addButton( 'pbsandwich_column', {
            title: pbsandwich_column.modal_title,
            icon: 'wp_tagcloud',
			type: 'menubutton',
			menu: [
				{
	                text: _pbsandwich_columns_sprintf( pbsandwich_column.columns, '2' ),
	                value: '1/2+1/2',
	                onclick: function() {
						preUpdateSortable( editor );
	                    editor.insertContent( _pbsandwich_columns_formTable( this.value(), editor.selection.getContent() ) );
						updateSortable( editor );
						fixTableParagraphs( editor );
	                }
				}, {
	                text: _pbsandwich_columns_sprintf( pbsandwich_column.columns, '3' ),
	                value: '1/3+1/3+1/3',
	                onclick: function() {
						preUpdateSortable( editor );
	                    editor.insertContent( _pbsandwich_columns_formTable( this.value(), editor.selection.getContent() ) );
						updateSortable( editor );
						fixTableParagraphs( editor );
	                }
				}, {
	                text: _pbsandwich_columns_sprintf( pbsandwich_column.columns, '4' ),
	                value: '1/4+1/4+1/4+1/4',
	                onclick: function() {
						preUpdateSortable( editor );
	                    editor.insertContent( _pbsandwich_columns_formTable( this.value(), editor.selection.getContent() ) );
						updateSortable( editor );
						fixTableParagraphs( editor );
	                }
				}, {
	                text: _pbsandwich_columns_sprintf( pbsandwich_column.columns, '1/3 + 2/3' ),
	                value: '1/3+2/3',
	                onclick: function() {
						preUpdateSortable( editor );
	                    editor.insertContent( _pbsandwich_columns_formTable( this.value(), editor.selection.getContent() ) );
						updateSortable( editor );
						fixTableParagraphs( editor );
	                }
				}, {
	                text: _pbsandwich_columns_sprintf( pbsandwich_column.columns, '2/3 + 1/3' ),
	                value: '2/3+1/3',
	                onclick: function() {
						preUpdateSortable( editor );
	                    editor.insertContent( _pbsandwich_columns_formTable( this.value(), editor.selection.getContent() ) );
						updateSortable( editor );
						fixTableParagraphs( editor );
	                }
				}, {
	                text: _pbsandwich_columns_sprintf( pbsandwich_column.columns, '1/4 + 1/2 + 1/4' ),
	                value: '1/4+2/4+1/4',
	                onclick: function() {
						preUpdateSortable( editor );
	                    editor.insertContent( _pbsandwich_columns_formTable( this.value(), editor.selection.getContent() ) );
						updateSortable( editor );
						fixTableParagraphs( editor );
	                }
				}, {
	                text: pbsandwich_column.custom_columns,
					onclick: function() {
					    editor.windowManager.open( {
					        title: pbsandwich_column.custom_columns,
					        body: [{
					            type: 'textbox',
					            name: 'columns',
					            label: pbsandwich_column.modal_title,
								value: '1/2+1/2'
					        },
							{
								type: 'container',
								html: '<p style="line-height: 1.6em;">' + pbsandwich_column.modal_description + '<code style="font-family: monospace; background: #eee; padding: 0 .4em; line-height: 1.6em; display: inline-block; border: 1px solid #ddd; border-radius: 4px;">1/2+1/2</code> <code style="font-family: monospace; background: #eee; padding: 0 .4em; line-height: 1.6em; display: inline-block; border: 1px solid #ddd; border-radius: 4px;">1/3+1/3+1/3</code> <code style="font-family: monospace; background: #eee; padding: 0 .4em; line-height: 1.6em; display: inline-block; border: 1px solid #ddd; border-radius: 4px;">1/4+2/4+1/4</code></p>'
							}],
					        onsubmit: function( e ) {
								preUpdateSortable( editor );
			                    editor.insertContent( _pbsandwich_columns_formTable( e.data.columns, editor.selection.getContent() ) );
								updateSortable( editor );
								fixTableParagraphs( editor );
					        }
					    });
					}
				}
			]
        });
    });
})();